import "server-only";

import { and, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { performanceTracker, tests } from "@/db/schema/assessment";
import { subjects, topics } from "@/db/schema/academic";
import { assignmentSubmissions, assignments } from "@/db/schema/teaching";
import { listTeacherPerformanceDirectoryStudents } from "@/lib/teachers/teacher-performance-directory-queries";
import type {
	TeacherClassPerformanceScope,
	TeacherClassPerformanceSummary,
	TeacherClassUpliftOpportunity,
	TeacherPerformanceBandId,
	TeacherPerformanceBandStudent,
	TeacherPerformanceBandSummary,
} from "@/lib/teachers/teacher-class-performance-summary-types";

export const CLASS_PERFORMANCE_RECENT_WINDOW_SIZE = 5;
export const CLASS_PERFORMANCE_SUPPORT_LINE_PERCENT = 60;
export const CLASS_PERFORMANCE_BANDS: Omit<TeacherPerformanceBandSummary, "count" | "students">[] = [
	{
		id: "strong",
		label: "Strong",
		rangeLabel: "90-100%",
		description: "Extension-ready",
	},
	{
		id: "near_target",
		label: "Near target",
		rangeLabel: "75-89%",
		description: "Whole-class review",
	},
	{
		id: "needs_support",
		label: "Needs support",
		rangeLabel: "60-74%",
		description: "Small-group practice",
	},
	{
		id: "at_risk",
		label: "At risk",
		rangeLabel: "<60%",
		description: "Intervene this week",
	},
];

export type RecentScoreEvent = {
	studentId: string;
	percent: number;
	occurredAtMs: number;
};

export type RecentClassAverageStudentProfile = {
	id: string;
	fullName: string;
	grade: number | null;
	section: string | null;
};

export type RecentClassAverageInput = {
	studentIds: string[];
	studentProfiles?: RecentClassAverageStudentProfile[];
	events: RecentScoreEvent[];
	recentWindowSize?: number;
};

export type RecentClassAverageResult = Pick<
	TeacherClassPerformanceSummary,
	| "studentsWithRecentScores"
	| "classAveragePercent"
	| "recentGradedItemsUsed"
	| "recentWindowSize"
	| "performanceBands"
>;

export type UpliftOpportunityInput = {
	studentsInScope: number;
	supportLinePercent?: number;
	topics: TeacherClassUpliftOpportunity[];
};

function toNumber(score: string | number | null | undefined): number | null {
	if (score == null || score === "") return null;
	const n = typeof score === "number" ? score : Number(score);
	return Number.isFinite(n) ? n : null;
}

function roundPercent(value: number): number {
	return Math.round(value * 10) / 10;
}

function emptyPerformanceBands(): TeacherPerformanceBandSummary[] {
	return CLASS_PERFORMANCE_BANDS.map((band) => ({
		...band,
		count: 0,
		students: [],
	}));
}

function performanceBandForAverage(averagePercent: number): TeacherPerformanceBandId {
	if (averagePercent >= 90) return "strong";
	if (averagePercent >= 75) return "near_target";
	if (averagePercent >= 60) return "needs_support";
	return "at_risk";
}

export function computeRecentClassAverage({
	studentIds,
	studentProfiles = [],
	events,
	recentWindowSize = CLASS_PERFORMANCE_RECENT_WINDOW_SIZE,
}: RecentClassAverageInput): RecentClassAverageResult {
	const inScope = new Set(studentIds);
	const profilesById = new Map(studentProfiles.map((student) => [student.id, student]));
	const eventsByStudent = new Map<string, RecentScoreEvent[]>();

	for (const studentId of studentIds) {
		eventsByStudent.set(studentId, []);
	}

	for (const event of events) {
		if (!inScope.has(event.studentId) || !Number.isFinite(event.percent)) continue;
		eventsByStudent.get(event.studentId)?.push(event);
	}

	let recentGradedItemsUsed = 0;
	const studentAverages: number[] = [];
	const bandsById = new Map<TeacherPerformanceBandId, TeacherPerformanceBandSummary>(
		emptyPerformanceBands().map((band) => [band.id, band]),
	);

	for (const [studentId, studentEvents] of eventsByStudent.entries()) {
		const recentEvents = studentEvents
			.sort((a, b) => b.occurredAtMs - a.occurredAtMs)
			.slice(0, recentWindowSize);
		if (recentEvents.length === 0) continue;

		recentGradedItemsUsed += recentEvents.length;
		const averagePercent = roundPercent(recentEvents.reduce((sum, event) => sum + event.percent, 0) / recentEvents.length);
		studentAverages.push(averagePercent);

		const profile = profilesById.get(studentId);
		const bandId = performanceBandForAverage(averagePercent);
		const band = bandsById.get(bandId);
		const student: TeacherPerformanceBandStudent = {
			studentId,
			fullName: profile?.fullName ?? "Student",
			grade: profile?.grade ?? null,
			section: profile?.section ?? null,
			averagePercent,
			recentGradedItemsUsed: recentEvents.length,
		};
		band?.students.push(student);
	}

	if (studentAverages.length === 0) {
		return {
			studentsWithRecentScores: 0,
			classAveragePercent: null,
			recentGradedItemsUsed: 0,
			recentWindowSize,
			performanceBands: emptyPerformanceBands(),
		};
	}

	const performanceBands = CLASS_PERFORMANCE_BANDS.map((band) => {
		const populated = bandsById.get(band.id);
		const students = [...(populated?.students ?? [])].sort(
			(a, b) => a.averagePercent - b.averagePercent || a.fullName.localeCompare(b.fullName),
		);
		return {
			...band,
			count: students.length,
			students,
		};
	});

	return {
		studentsWithRecentScores: studentAverages.length,
		classAveragePercent: roundPercent(
			studentAverages.reduce((sum, average) => sum + average, 0) / studentAverages.length,
		),
		recentGradedItemsUsed,
		recentWindowSize,
		performanceBands,
	};
}

export function selectUpliftOpportunity({
	studentsInScope,
	supportLinePercent = CLASS_PERFORMANCE_SUPPORT_LINE_PERCENT,
	topics: topicRows,
}: UpliftOpportunityInput): TeacherClassUpliftOpportunity | null {
	if (studentsInScope <= 0 || topicRows.length === 0) return null;

	const minimumCoverage = studentsInScope <= 2 ? 1 : Math.max(2, Math.ceil(studentsInScope * 0.25));
	const eligibleRows = topicRows.filter((topic) => topic.studentsTested >= minimumCoverage);
	const candidates = eligibleRows.length > 0 ? eligibleRows : topicRows;

	return [...candidates].sort((a, b) => {
		const coverageA = a.studentsTested / studentsInScope;
		const coverageB = b.studentsTested / studentsInScope;
		const scoreA =
			Math.max(0, supportLinePercent - a.averagePercent) * (0.65 + Math.min(1, coverageA) * 0.35) +
			a.studentsBelowSupportLine * 2;
		const scoreB =
			Math.max(0, supportLinePercent - b.averagePercent) * (0.65 + Math.min(1, coverageB) * 0.35) +
			b.studentsBelowSupportLine * 2;

		return (
			scoreB - scoreA ||
			a.averagePercent - b.averagePercent ||
			b.studentsTested - a.studentsTested ||
			b.testsTaken - a.testsTaken ||
			a.topicName.localeCompare(b.topicName)
		);
	})[0] ?? null;
}

function buildTopicOpportunities(
	rows: {
		topicId: string;
		topicName: string;
		subjectName: string;
		studentId: string;
		averageScore: string | null;
		testsTaken: number | null;
	}[],
): TeacherClassUpliftOpportunity[] {
	const byTopic = new Map<
		string,
		{
			topicId: string;
			topicName: string;
			subjectName: string;
			scoreSum: number;
			studentsTested: number;
			testsTaken: number;
			studentsBelowSupportLine: number;
		}
	>();

	for (const row of rows) {
		const averageScore = toNumber(row.averageScore);
		const testsTaken = row.testsTaken ?? 0;
		if (averageScore == null || testsTaken <= 0) continue;

		const bucket =
			byTopic.get(row.topicId) ??
			{
				topicId: row.topicId,
				topicName: row.topicName,
				subjectName: row.subjectName,
				scoreSum: 0,
				studentsTested: 0,
				testsTaken: 0,
				studentsBelowSupportLine: 0,
			};

		bucket.scoreSum += averageScore;
		bucket.studentsTested += 1;
		bucket.testsTaken += testsTaken;
		if (averageScore < CLASS_PERFORMANCE_SUPPORT_LINE_PERCENT) {
			bucket.studentsBelowSupportLine += 1;
		}
		byTopic.set(row.topicId, bucket);
	}

	return [...byTopic.values()].map((topic) => ({
		topicId: topic.topicId,
		topicName: topic.topicName,
		subjectName: topic.subjectName,
		averagePercent: roundPercent(topic.scoreSum / topic.studentsTested),
		studentsTested: topic.studentsTested,
		testsTaken: topic.testsTaken,
		studentsBelowSupportLine: topic.studentsBelowSupportLine,
	}));
}

export async function getTeacherClassPerformanceSummary(
	params: TeacherClassPerformanceScope,
): Promise<TeacherClassPerformanceSummary> {
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

	if (roster.length === 0) {
		return {
			studentsInScope: 0,
			studentsWithRecentScores: 0,
			classAveragePercent: null,
			recentGradedItemsUsed: 0,
			recentWindowSize: CLASS_PERFORMANCE_RECENT_WINDOW_SIZE,
			performanceBands: emptyPerformanceBands(),
			upliftOpportunity: null,
		};
	}

	const studentIds = roster.map((student) => student.id);

	const recentEvents = await loadRecentScoreEventsForTeacherStudents({
		teacherId: params.teacherId,
		studentIds,
		scopeSubject,
	});

	const recentAverage = computeRecentClassAverage({
		studentIds,
		studentProfiles: roster,
		events: recentEvents,
		recentWindowSize: CLASS_PERFORMANCE_RECENT_WINDOW_SIZE,
	});

	const topicFilters = [
		inArray(performanceTracker.studentId, studentIds),
		isNotNull(performanceTracker.averageScore),
		gt(performanceTracker.testsTaken, 0),
	];
	if (scopeSubject) {
		topicFilters.push(eq(performanceTracker.subjectId, scopeSubject));
	}

	const topicRows = await db
		.select({
			topicId: performanceTracker.topicId,
			topicName: topics.topicName,
			subjectName: subjects.name,
			studentId: performanceTracker.studentId,
			averageScore: performanceTracker.averageScore,
			testsTaken: performanceTracker.testsTaken,
		})
		.from(performanceTracker)
		.innerJoin(topics, eq(topics.id, performanceTracker.topicId))
		.innerJoin(subjects, eq(subjects.id, performanceTracker.subjectId))
		.where(and(...topicFilters));

	const topicOpportunities = buildTopicOpportunities(topicRows);

	return {
		studentsInScope: studentIds.length,
		...recentAverage,
		upliftOpportunity: selectUpliftOpportunity({
			studentsInScope: studentIds.length,
			topics: topicOpportunities,
		}),
	};
}

async function loadRecentScoreEventsForTeacherStudents(params: {
	teacherId: string;
	studentIds: string[];
	scopeSubject?: string;
}): Promise<RecentScoreEvent[]> {
	const { teacherId, studentIds, scopeSubject } = params;
	if (studentIds.length === 0) return [];

	const assignmentFilters = [
		eq(assignments.teacherId, teacherId),
		eq(assignments.status, "published"),
		inArray(assignmentSubmissions.studentId, studentIds),
		eq(assignmentSubmissions.lifecycleStatus, "graded"),
		isNotNull(assignmentSubmissions.score),
		isNotNull(assignmentSubmissions.gradedAt),
	];
	if (scopeSubject) {
		assignmentFilters.push(sql`(assignments.config->>'subject_id')::uuid = ${scopeSubject}::uuid`);
	}

	const submissionRows = await db
		.select({
			studentId: assignmentSubmissions.studentId,
			score: assignmentSubmissions.score,
			gradedAt: assignmentSubmissions.gradedAt,
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

	const recentEvents: RecentScoreEvent[] = [];
	for (const row of submissionRows) {
		const percent = toNumber(row.score);
		if (percent == null || !row.gradedAt) continue;
		recentEvents.push({ studentId: row.studentId, percent, occurredAtMs: row.gradedAt.getTime() });
	}
	for (const row of practiceRows) {
		const percent = toNumber(row.totalScore);
		const occurredAt = row.testDate ?? row.createdAt;
		if (percent == null || !occurredAt) continue;
		recentEvents.push({ studentId: row.studentId, percent, occurredAtMs: occurredAt.getTime() });
	}
	return recentEvents;
}

/** Latest graded items per student — same window as class dashboard — mapped to a performance band; `null` if nothing graded in scope. */
export function computeRecentPerformanceBandPerStudent({
	studentIds,
	events,
	recentWindowSize = CLASS_PERFORMANCE_RECENT_WINDOW_SIZE,
}: {
	studentIds: string[];
	events: RecentScoreEvent[];
	recentWindowSize?: number;
}): Map<string, TeacherPerformanceBandId | null> {
	const inScope = new Set(studentIds);
	const eventsByStudent = new Map<string, RecentScoreEvent[]>();
	for (const studentId of studentIds) {
		eventsByStudent.set(studentId, []);
	}
	for (const event of events) {
		if (!inScope.has(event.studentId) || !Number.isFinite(event.percent)) continue;
		eventsByStudent.get(event.studentId)?.push(event);
	}
	const out = new Map<string, TeacherPerformanceBandId | null>();
	for (const studentId of studentIds) {
		const studentEvents = eventsByStudent.get(studentId) ?? [];
		const recentForStudent = studentEvents
			.sort((a, b) => b.occurredAtMs - a.occurredAtMs)
			.slice(0, recentWindowSize);
		if (recentForStudent.length === 0) {
			out.set(studentId, null);
			continue;
		}
		const averagePercent = roundPercent(
			recentForStudent.reduce((sum, event) => sum + event.percent, 0) / recentForStudent.length,
		);
		out.set(studentId, performanceBandForAverage(averagePercent));
	}
	return out;
}

/** Bands from the same inputs as the teacher dashboard: this teacher's graded assignments + students' practice, for one subject. */
export async function getTeacherStudentPerformanceBandsForSubject(params: {
	teacherId: string;
	studentIds: string[];
	subjectId: string;
}): Promise<Map<string, TeacherPerformanceBandId | null>> {
	if (params.studentIds.length === 0) {
		return new Map();
	}
	const events = await loadRecentScoreEventsForTeacherStudents({
		teacherId: params.teacherId,
		studentIds: params.studentIds,
		scopeSubject: params.subjectId,
	});
	return computeRecentPerformanceBandPerStudent({
		studentIds: params.studentIds,
		events,
		recentWindowSize: CLASS_PERFORMANCE_RECENT_WINDOW_SIZE,
	});
}
