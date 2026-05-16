import "server-only";

import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { tests } from "@/db/schema/assessment";
import { assignmentSubmissions, assignments } from "@/db/schema/teaching";
import {
	listTeacherPerformanceDirectoryStudents,
	type TeacherPerformanceStudentRow,
} from "@/lib/teachers/teacher-performance-directory-queries";
import type { TeacherAtRiskStudentRow } from "@/lib/teachers/teacher-at-risk-types";

/** Product rule: mean of up to 5 most recent graded items (assignments + self-practice tests) must stay at or above this. */
export const AT_RISK_SCORE_THRESHOLD_PERCENT = 60;
export const AT_RISK_LAST_GRADED_COUNT = 5;

export type { TeacherAtRiskStudentRow };

const NOT_SUBMITTED_STATUSES = new Set([
	"pending_materialize",
	"ready",
	"in_progress",
	"failed_generation",
	"grading_failed",
]);

function toNumber(score: string | null): number | null {
	if (score == null || score === "") return null;
	const n = Number(score);
	return Number.isFinite(n) ? n : null;
}

function buildSummary(params: {
	avg: number | null;
	nGraded: number;
	overdue: number;
	late: number;
	lowAssign: number;
}): string {
	const parts: string[] = [];
	if (params.nGraded > 0 && params.avg != null) {
		parts.push(`Last ${params.nGraded} graded · avg ${Math.round(params.avg)}%`);
	}
	if (params.overdue > 0) {
		parts.push(`${params.overdue} overdue (not submitted)`);
	}
	if (params.late > 0) {
		parts.push(`${params.late} late`);
	}
	if (params.lowAssign > 0) {
		parts.push(
			`${params.lowAssign} assignment${params.lowAssign === 1 ? "" : "s"} below ${AT_RISK_SCORE_THRESHOLD_PERCENT}%`,
		);
	}
	return parts.length ? parts.join(" · ") : "Needs attention";
}

/**
 * Students visible under the dashboard scope who are at-risk by v1 rules:
 * - Mean of their last {AT_RISK_LAST_GRADED_COUNT} graded items (practice + teacher assignments) below {AT_RISK_SCORE_THRESHOLD_PERCENT}%, when at least one graded item exists; and/or
 * - Published teacher assignments missing past due, turned in late, or graded below threshold.
 */
export async function listTeacherAtRiskStudents(params: {
	teacherId: string;
	activeOrganizationId: string | null;
	grade: number | "all";
	section: string | "all";
	subjectId: string | "all";
}): Promise<TeacherAtRiskStudentRow[]> {
	const scopeGrade = params.grade === "all" ? undefined : params.grade;
	const scopeSection = params.section === "all" ? undefined : params.section;
	const scopeSubject = params.subjectId === "all" ? undefined : params.subjectId;

	const roster = await listTeacherPerformanceDirectoryStudents({
		teacherId: params.teacherId,
		activeOrganizationId: params.activeOrganizationId,
		grade: scopeGrade,
		section: scopeSection,
		subjectId: scopeSubject,
	});

	return listTeacherAtRiskStudentsForRoster({
		teacherId: params.teacherId,
		roster,
		subjectId: scopeSubject,
	});
}

export async function listTeacherAtRiskStudentsForRoster(params: {
	teacherId: string;
	roster: TeacherPerformanceStudentRow[];
	subjectId?: string | "all" | null;
}): Promise<TeacherAtRiskStudentRow[]> {
	const scopeSubject = params.subjectId === "all" ? undefined : (params.subjectId ?? undefined);
	const roster = params.roster;

	if (roster.length === 0) {
		return [];
	}

	const studentIds = roster.map((r) => r.id);
	const nameById = new Map(roster.map((r) => [r.id, r.fullName]));

	const assignmentFilters = [
		eq(assignments.teacherId, params.teacherId),
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
			score: assignmentSubmissions.score,
			gradedAt: assignmentSubmissions.gradedAt,
			submittedAt: assignmentSubmissions.submittedAt,
			isLate: assignmentSubmissions.isLate,
			dueAt: assignments.dueAt,
		})
		.from(assignmentSubmissions)
		.innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
		.where(and(...assignmentFilters));

	const practiceFilters = [
		inArray(tests.studentId, studentIds),
		eq(tests.status, "graded"),
		isNotNull(tests.totalScore),
		eq(tests.isDraft, false),
		isNull(tests.assignmentSubmissionId),
	];
	if (scopeSubject) {
		practiceFilters.push(eq(tests.subjectId, scopeSubject));
	}

	const practiceRows = await db
		.select({
			studentId: tests.studentId,
			totalScore: tests.totalScore,
			testDate: tests.testDate,
			createdAt: tests.createdAt,
		})
		.from(tests)
		.where(and(...practiceFilters));

	const now = Date.now();
	const byStudent = new Map<
		string,
		{
			gradedEvents: { at: number; pct: number }[];
			overdue: number;
			late: number;
			lowScoredAssignments: number;
		}
	>();

	for (const id of studentIds) {
		byStudent.set(id, { gradedEvents: [], overdue: 0, late: 0, lowScoredAssignments: 0 });
	}

	for (const row of submissionRows) {
		const bucket = byStudent.get(row.studentId);
		if (!bucket) continue;

		if (row.lifecycleStatus === "graded" && row.gradedAt) {
			const pct = toNumber(row.score);
			if (pct != null) {
				bucket.gradedEvents.push({ at: row.gradedAt.getTime(), pct });
			}
			if (pct != null && pct < AT_RISK_SCORE_THRESHOLD_PERCENT) {
				bucket.lowScoredAssignments += 1;
			}
		}

		const due = row.dueAt;
		if (due && now > due.getTime() && NOT_SUBMITTED_STATUSES.has(row.lifecycleStatus)) {
			bucket.overdue += 1;
		}

		const submittedLateByFlag = row.isLate === true;
		const submittedAfterDue =
			row.submittedAt != null &&
			due != null &&
			row.submittedAt.getTime() > due.getTime() &&
			!NOT_SUBMITTED_STATUSES.has(row.lifecycleStatus);
		if (submittedLateByFlag || submittedAfterDue || row.lifecycleStatus === "late") {
			bucket.late += 1;
		}
	}

	for (const row of practiceRows) {
		const bucket = byStudent.get(row.studentId);
		if (!bucket) continue;
		const pct = toNumber(row.totalScore);
		if (pct == null) continue;
		const occurredAt = row.testDate ?? row.createdAt;
		if (!occurredAt) continue;
		const at = occurredAt.getTime();
		bucket.gradedEvents.push({ at, pct });
	}

	const results: TeacherAtRiskStudentRow[] = [];

	for (const id of studentIds) {
		const bucket = byStudent.get(id);
		if (!bucket) continue;

		const events = [...bucket.gradedEvents].sort((a, b) => b.at - a.at).slice(0, AT_RISK_LAST_GRADED_COUNT);
		const nGraded = events.length;
		const avg = nGraded > 0 ? events.reduce((s, e) => s + e.pct, 0) / nGraded : null;

		const weakRecent = avg != null && avg < AT_RISK_SCORE_THRESHOLD_PERCENT;
		const assignmentStress =
			bucket.overdue > 0 || bucket.late > 0 || bucket.lowScoredAssignments > 0;

		if (!weakRecent && !assignmentStress) {
			continue;
		}

		let severityScore = 0;
		if (weakRecent && avg != null) {
			severityScore += (AT_RISK_SCORE_THRESHOLD_PERCENT - avg) * 2;
		}
		severityScore += Math.min(45, bucket.overdue * 14);
		severityScore += Math.min(28, bucket.late * 7);
		severityScore += Math.min(22, bucket.lowScoredAssignments * 5);

		results.push({
			studentId: id,
			fullName: nameById.get(id) ?? "Student",
			severityScore,
			lastFiveAveragePercent: avg != null ? Math.round(avg * 10) / 10 : null,
			gradedItemsUsed: nGraded,
			overdueAssignments: bucket.overdue,
			lateAssignments: bucket.late,
			lowScoredAssignments: bucket.lowScoredAssignments,
			summary: buildSummary({
				avg,
				nGraded,
				overdue: bucket.overdue,
				late: bucket.late,
				lowAssign: bucket.lowScoredAssignments,
			}),
		});
	}

	results.sort((a, b) => b.severityScore - a.severityScore);

	return results;
}
