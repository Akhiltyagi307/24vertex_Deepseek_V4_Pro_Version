import "server-only";

import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { teacherStudentLinks } from "@/db/schema/organizations";
import { profiles } from "@/db/schema/profiles";
import { assignmentSubmissions, assignments } from "@/db/schema/teaching";
import {
	getOrganizationRosterFilterOptions,
	listOrganizationStudentsWithFilters,
	type OrganizationRosterFilterOptions,
	type OrganizationRosterStudentRow,
} from "@/lib/teachers/roster-queries";
import {
	CLASS_PERFORMANCE_RECENT_WINDOW_SIZE,
	loadRecentScoreEventsForTeacherStudents,
} from "@/lib/teachers/teacher-class-performance-summary";
import type { TeacherPerformanceBandId } from "@/lib/teachers/teacher-class-performance-summary-types";

export type TeacherPerformanceStudentRow = OrganizationRosterStudentRow;

/** Days without any graded event before a student is considered inactive on the directory. */
export const TEACHER_DIRECTORY_INACTIVE_THRESHOLD_DAYS = 7;

/** Submission lifecycle statuses that mean the student has not yet handed in. */
const NOT_SUBMITTED_STATUSES = new Set([
	"pending_materialize",
	"ready",
	"in_progress",
	"failed_generation",
	"grading_failed",
]);

export type TeacherPerformanceDirectoryRow = TeacherPerformanceStudentRow & {
	recentAveragePercent: number | null;
	recentItemsUsed: number;
	band: TeacherPerformanceBandId | null;
	overdueAssignments: number;
	lateAssignments: number;
	lastActivityMs: number | null;
};

function performanceBandForAverage(avg: number): TeacherPerformanceBandId {
	if (avg >= 90) return "strong";
	if (avg >= 75) return "near_target";
	if (avg >= 60) return "needs_support";
	return "at_risk";
}

function roundPercent(value: number): number {
	return Math.round(value * 10) / 10;
}

function mapRows(
	rows: {
		id: string;
		fullName: string;
		grade: number | null;
		section: string | null;
		studentLinkCode: string | null;
	}[],
): TeacherPerformanceStudentRow[] {
	return rows.map((r) => ({
		id: r.id,
		fullName: r.fullName,
		grade: r.grade,
		section: r.section,
		studentLinkCode: r.studentLinkCode,
	}));
}

const independentLinkWhereBase = (teacherId: string) =>
	and(
		eq(teacherStudentLinks.teacherId, teacherId),
		eq(teacherStudentLinks.status, "active"),
		eq(profiles.role, "student"),
		isNull(profiles.deletedAt),
	);

/** Org roster or independent link-code students, with optional placement/subject filters. */
export async function listTeacherPerformanceDirectoryStudents(params: {
	teacherId: string;
	activeOrganizationId: string | null;
	grade?: number | null;
	section?: string | null;
	subjectId?: string | null;
}): Promise<TeacherPerformanceStudentRow[]> {
	if (params.activeOrganizationId) {
		return listOrganizationStudentsWithFilters({
			organizationId: params.activeOrganizationId,
			grade: params.grade ?? undefined,
			section: params.section ?? undefined,
			subjectId: params.subjectId ?? undefined,
		});
	}

	const conditions = [independentLinkWhereBase(params.teacherId)];

	if (params.grade != null) {
		conditions.push(eq(profiles.grade, params.grade));
	}

	const trimmedSection = params.section?.trim();
	if (trimmedSection) {
		conditions.push(eq(profiles.section, trimmedSection));
	}

	const sid = params.subjectId?.trim();
	if (sid) {
		conditions.push(
			sql`EXISTS (
				SELECT 1
				FROM public.get_student_subjects(${profiles.grade}, ${profiles.stream}, ${profiles.electiveSubjectId}) gs
				WHERE gs.id = ${sid}::uuid
			)`,
		);
	}

	const rows = await db
		.select({
			id: profiles.id,
			fullName: profiles.fullName,
			grade: profiles.grade,
			section: profiles.section,
			studentLinkCode: profiles.studentLinkCode,
		})
		.from(teacherStudentLinks)
		.innerJoin(profiles, eq(profiles.id, teacherStudentLinks.studentId))
		.where(and(...conditions))
		.orderBy(asc(profiles.grade), asc(profiles.section), asc(profiles.fullName));

	return mapRows(rows);
}

async function getIndependentTeacherPerformanceFilterOptions(
	teacherId: string,
): Promise<OrganizationRosterFilterOptions> {
	const base = independentLinkWhereBase(teacherId);

	const gradeRows = await db
		.select({ grade: profiles.grade })
		.from(teacherStudentLinks)
		.innerJoin(profiles, eq(profiles.id, teacherStudentLinks.studentId))
		.where(and(base, isNotNull(profiles.grade)))
		.groupBy(profiles.grade)
		.orderBy(asc(profiles.grade));

	const sectionRows = await db
		.select({ section: profiles.section })
		.from(teacherStudentLinks)
		.innerJoin(profiles, eq(profiles.id, teacherStudentLinks.studentId))
		.where(and(base, isNotNull(profiles.section)))
		.groupBy(profiles.section)
		.orderBy(asc(profiles.section));

	const grades = gradeRows.map((r) => r.grade).filter((g): g is number => g != null);
	const sections = sectionRows
		.map((r) => r.section?.trim())
		.filter((s): s is string => Boolean(s && s.length > 0));

	return { grades, sections };
}

export async function getTeacherPerformanceDirectoryFilterOptions(params: {
	activeOrganizationId: string | null;
	teacherId: string;
}): Promise<OrganizationRosterFilterOptions> {
	if (params.activeOrganizationId) {
		return getOrganizationRosterFilterOptions(params.activeOrganizationId);
	}
	return getIndependentTeacherPerformanceFilterOptions(params.teacherId);
}

/**
 * Returns the directory roster enriched with the same recent-window signals the dashboard uses
 * (last {CLASS_PERFORMANCE_RECENT_WINDOW_SIZE} graded items = teacher assignments + self-practice tests),
 * plus a count of outstanding-past-due and late submissions on this teacher's published assignments.
 *
 * When `subjectId` is set, every metric is scoped to that subject. When omitted/null, metrics span all
 * subjects the student is enrolled in — same convention as the teacher dashboard.
 */
export async function listTeacherPerformanceDirectoryRows(params: {
	teacherId: string;
	activeOrganizationId: string | null;
	grade?: number | null;
	section?: string | null;
	subjectId?: string | null;
}): Promise<TeacherPerformanceDirectoryRow[]> {
	const roster = await listTeacherPerformanceDirectoryStudents(params);
	return enrichTeacherPerformanceDirectoryRows({
		teacherId: params.teacherId,
		roster,
		subjectId: params.subjectId,
	});
}

async function enrichTeacherPerformanceDirectoryRows(params: {
	teacherId: string;
	roster: TeacherPerformanceStudentRow[];
	subjectId?: string | null;
}): Promise<TeacherPerformanceDirectoryRow[]> {
	const { teacherId, roster } = params;
	if (roster.length === 0) return [];

	const studentIds = roster.map((r) => r.id);
	const scopeSubject = params.subjectId?.trim() ? params.subjectId.trim() : undefined;

	const events = await loadRecentScoreEventsForTeacherStudents({
		teacherId,
		studentIds,
		scopeSubject,
	});

	const eventsByStudent = new Map<string, { occurredAtMs: number; percent: number }[]>();
	for (const id of studentIds) eventsByStudent.set(id, []);
	for (const e of events) {
		if (!Number.isFinite(e.percent)) continue;
		eventsByStudent.get(e.studentId)?.push({ occurredAtMs: e.occurredAtMs, percent: e.percent });
	}

	const assignmentFilters = [
		eq(assignments.teacherId, teacherId),
		eq(assignments.status, "published"),
		inArray(assignmentSubmissions.studentId, studentIds),
	];
	if (scopeSubject) {
		assignmentFilters.push(sql`(assignments.config->>'subject_id')::uuid = ${scopeSubject}::uuid`);
	}
	const submissionRows = await db
		.select({
			studentId: assignmentSubmissions.studentId,
			lifecycleStatus: assignmentSubmissions.lifecycleStatus,
			submittedAt: assignmentSubmissions.submittedAt,
			isLate: assignmentSubmissions.isLate,
			dueAt: assignments.dueAt,
		})
		.from(assignmentSubmissions)
		.innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
		.where(and(...assignmentFilters));

	const nowMs = Date.now();
	const submissionAggByStudent = new Map<string, { overdue: number; late: number }>();
	for (const id of studentIds) submissionAggByStudent.set(id, { overdue: 0, late: 0 });
	for (const row of submissionRows) {
		const bucket = submissionAggByStudent.get(row.studentId);
		if (!bucket) continue;
		const dueMs = row.dueAt ? row.dueAt.getTime() : null;
		if (dueMs != null && nowMs > dueMs && NOT_SUBMITTED_STATUSES.has(row.lifecycleStatus)) {
			bucket.overdue += 1;
		}
		const submittedAfterDue =
			row.submittedAt != null &&
			dueMs != null &&
			row.submittedAt.getTime() > dueMs &&
			!NOT_SUBMITTED_STATUSES.has(row.lifecycleStatus);
		if (row.isLate === true || submittedAfterDue || row.lifecycleStatus === "late") {
			bucket.late += 1;
		}
	}

	return roster.map((student) => {
		const studentEvents = (eventsByStudent.get(student.id) ?? [])
			.slice()
			.sort((a, b) => b.occurredAtMs - a.occurredAtMs);
		const recentWindow = studentEvents.slice(0, CLASS_PERFORMANCE_RECENT_WINDOW_SIZE);
		const recentItemsUsed = recentWindow.length;
		const recentAveragePercent =
			recentItemsUsed === 0
				? null
				: roundPercent(recentWindow.reduce((s, e) => s + e.percent, 0) / recentItemsUsed);
		const band = recentAveragePercent == null ? null : performanceBandForAverage(recentAveragePercent);
		const lastActivityMs = studentEvents[0]?.occurredAtMs ?? null;
		const agg = submissionAggByStudent.get(student.id) ?? { overdue: 0, late: 0 };
		return {
			...student,
			recentAveragePercent,
			recentItemsUsed,
			band,
			overdueAssignments: agg.overdue,
			lateAssignments: agg.late,
			lastActivityMs,
		};
	});
}
