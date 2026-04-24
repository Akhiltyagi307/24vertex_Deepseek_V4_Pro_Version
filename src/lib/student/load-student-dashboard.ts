import "server-only";

import type {
	StudentDashboardAssignmentSummary,
	StudentDashboardRecentTest,
	StudentDashboardSubjectCard,
} from "@/components/student/student-dashboard-view";
import { buildStudentDashboardAnalyticsPayload } from "@/lib/student/dashboard-analytics";
import { buildDashboardPerformanceStats } from "@/lib/student/dashboard-performance-stats";
import { pickStudentDashboardGreeting } from "@/lib/student/dashboard-greeting";
import {
	averageTestScorePercentForSubject,
	buildEnrolledSubjectCards,
	buildSubjectCardTrackerStats,
	dominantStatusFromTrackerStats,
	emptySubjectCardTrackerStats,
} from "@/lib/student/performance-matrix";
import type { StudentProfileSubjectsRow } from "@/lib/student/student-performance-load";
import { loadStudentPerformanceBundle } from "@/lib/student/student-performance-load";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type StudentDashboardProfileRow = StudentProfileSubjectsRow & {
	section: string | null;
	full_name: string | null;
};

type DashboardCompletedTestRow = {
	id: string;
	test_date: string | null;
	total_score: string | number | null;
	subject_id: string;
	duration_seconds: number | null;
	time_limit_seconds: number | null;
};

type DashboardAssignmentRow = {
	id: string;
	title: string;
	due_date: string | null;
	time_limit_seconds: number | null;
	status: string | null;
	subject_id: string;
};

type DashboardAssignmentSubmissionRow = {
	assignment_id: string;
	status: string | null;
	submitted_at: string | null;
	score: string | number | null;
};

function parsePercent(v: string | number | null | undefined): number | null {
	if (v == null || v === "") return null;
	const parsed = typeof v === "number" ? v : Number.parseFloat(String(v));
	return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function statusPriority(status: "good" | "satisfactory" | "bad" | "not_tested"): number {
	if (status === "bad") return 0;
	if (status === "satisfactory") return 1;
	if (status === "not_tested") return 2;
	return 3;
}

function buildPracticeHref(subjectId: string, topicIds: string[]): string {
	const params = new URLSearchParams();
	params.set("subjectId", subjectId);
	if (topicIds.length) {
		params.set("topicIds", topicIds.join(","));
	}
	return `/student/practice?${params.toString()}`;
}

export type StudentDashboardViewPayload = {
	headerGreeting: string;
	performanceStats: ReturnType<typeof buildDashboardPerformanceStats>;
	subjectCards: StudentDashboardSubjectCard[];
	subjectsLoadError: string | null;
	analytics: ReturnType<typeof buildStudentDashboardAnalyticsPayload>;
	recentTests: StudentDashboardRecentTest[];
	assignmentSummary: StudentDashboardAssignmentSummary;
};

/**
 * Loads all data required by `StudentDashboardView` (server-only).
 * Keeps `app/student/dashboard/page.tsx` as auth + wiring only.
 */
export async function loadStudentDashboardViewPayload(
	supabase: SupabaseServer,
	userId: string,
	profileRow: StudentDashboardProfileRow,
): Promise<StudentDashboardViewPayload> {
	const bundleInput: StudentProfileSubjectsRow = {
		grade: profileRow.grade,
		stream: profileRow.stream,
		elective_subject_id: profileRow.elective_subject_id,
		role: profileRow.role,
	};

	const completedTestSelect =
		"id, test_date, total_score, subject_id, duration_seconds, time_limit_seconds";

	const [bundle, completedTestRes] = await Promise.all([
		loadStudentPerformanceBundle(supabase, userId, bundleInput),
		supabase
			.from("tests")
			.select(completedTestSelect)
			.eq("student_id", userId)
			.eq("is_draft", false)
			.in("status", ["submitted", "graded"])
			.order("test_date", { ascending: false }),
	]);

	const { enrolledSubjects, topicCountBySubjectId, rows, loadError } = bundle;
	const completedTestRows = completedTestRes.data;

	const assignmentSelect = "id, title, due_date, time_limit_seconds, status, subject_id";
	const assignmentMap = new Map<string, DashboardAssignmentRow>();

	const [gradeSectionRes, directRes] = await Promise.all([
		profileRow.grade != null ?
			(() => {
				let q = supabase
					.from("assignments")
					.select(assignmentSelect)
					.eq("status", "active")
					.contains("target_grades", [profileRow.grade]);
				if (profileRow.section) {
					q = q.contains("target_sections", [profileRow.section]);
				}
				return q;
			})()
		:	Promise.resolve({ data: [] as DashboardAssignmentRow[], error: null }),
		supabase
			.from("assignments")
			.select(assignmentSelect)
			.eq("status", "active")
			.contains("target_student_ids", [userId]),
	]);

	for (const row of gradeSectionRes.data ?? []) {
		assignmentMap.set(row.id, row as DashboardAssignmentRow);
	}
	for (const row of directRes.data ?? []) {
		assignmentMap.set(row.id, row as DashboardAssignmentRow);
	}

	const assignmentRows = [...assignmentMap.values()];
	const assignmentIds = assignmentRows.map((a) => a.id);
	let submissionByAssignmentId = new Map<string, DashboardAssignmentSubmissionRow>();
	if (assignmentIds.length > 0) {
		const { data: submissions } = await supabase
			.from("assignment_submissions")
			.select("assignment_id, status, submitted_at, score")
			.eq("student_id", userId)
			.in("assignment_id", assignmentIds);
		submissionByAssignmentId = new Map(
			(submissions ?? []).map((row) => [row.assignment_id as string, row as DashboardAssignmentSubmissionRow]),
		);
	}

	const performanceStats = buildDashboardPerformanceStats(rows, completedTestRows ?? []);

	const analytics = buildStudentDashboardAnalyticsPayload(
		(completedTestRows ?? []) as DashboardCompletedTestRow[],
		rows,
		enrolledSubjects.map((s) => ({ id: s.id, name: s.name })),
	);

	const enrolledSubjectCards = buildEnrolledSubjectCards(enrolledSubjects, topicCountBySubjectId, rows);
	const trackerMap = buildSubjectCardTrackerStats(rows);
	const weakRowsBySubject = new Map<
		string,
		{
			topicId: string;
			topicName: string;
			status: "good" | "satisfactory" | "bad" | "not_tested";
			testsTaken: number;
			averageScore: number | null;
		}[]
	>();
	for (const row of rows) {
		if (!weakRowsBySubject.has(row.subjectId)) {
			weakRowsBySubject.set(row.subjectId, []);
		}
		if (row.status !== "good") {
			weakRowsBySubject.get(row.subjectId)!.push({
				topicId: row.topicId,
				topicName: row.topicName,
				status: row.status,
				testsTaken: row.testsTaken,
				averageScore: row.averageScore,
			});
		}
	}
	for (const list of weakRowsBySubject.values()) {
		list.sort((a, b) => {
			const byStatus = statusPriority(a.status) - statusPriority(b.status);
			if (byStatus !== 0) return byStatus;
			const aScore = a.averageScore ?? 101;
			const bScore = b.averageScore ?? 101;
			if (aScore !== bScore) return aScore - bScore;
			return a.testsTaken - b.testsTaken;
		});
	}

	const subjectCards: StudentDashboardSubjectCard[] = enrolledSubjectCards.map((c) => {
		const st = trackerMap.get(c.subjectId) ?? emptySubjectCardTrackerStats;
		const weakTopicIds = (weakRowsBySubject.get(c.subjectId) ?? []).slice(0, 3).map((w) => w.topicId);
		return {
			subjectId: c.subjectId,
			subjectName: c.subjectName,
			percentCovered: c.percentCovered,
			topicTotal: c.topicTotal,
			attemptedCount: c.attemptedCount,
			testsTaken: st.testsTakenTotal,
			lastTestDateIso: st.lastTestDate,
			status: dominantStatusFromTrackerStats(st),
			scorePercent: averageTestScorePercentForSubject(rows, c.subjectId),
			practiceHref: buildPracticeHref(c.subjectId, weakTopicIds),
		};
	});

	const subjectNameById = new Map(enrolledSubjects.map((s) => [s.id, s.name]));
	const recentTests: StudentDashboardRecentTest[] = ((completedTestRows ?? []) as DashboardCompletedTestRow[])
		.slice(0, 5)
		.map((t) => ({
			id: t.id,
			subjectName: subjectNameById.get(t.subject_id) ?? "Subject",
			testDateIso: t.test_date,
			scorePercent: parsePercent(t.total_score),
			durationSeconds: t.duration_seconds,
		}));

	const submissionDone = new Set(["submitted", "graded", "completed"]);
	const nowTs = new Date().getTime();
	let pendingCount = 0;
	let overdueCount = 0;
	let completedCount = 0;
	let nextDueTitle: string | null = null;
	let nextDueIso: string | null = null;

	const pendingWithDue: { dueTs: number; title: string; dueIso: string | null }[] = [];
	for (const assignment of assignmentRows) {
		const submission = submissionByAssignmentId.get(assignment.id);
		const isCompleted =
			(submission?.status != null && submissionDone.has(submission.status)) ||
			submission?.submitted_at != null;
		const dueTs = assignment.due_date ? new Date(assignment.due_date).getTime() : Number.NaN;
		if (isCompleted) {
			completedCount += 1;
			continue;
		}
		pendingCount += 1;
		if (Number.isFinite(dueTs) && dueTs < nowTs) {
			overdueCount += 1;
		}
		pendingWithDue.push({
			dueTs: Number.isFinite(dueTs) ? dueTs : Number.MAX_SAFE_INTEGER,
			title: assignment.title,
			dueIso: assignment.due_date,
		});
	}
	pendingWithDue.sort((a, b) => a.dueTs - b.dueTs);
	if (pendingWithDue.length > 0) {
		nextDueTitle = pendingWithDue[0]!.title;
		nextDueIso = pendingWithDue[0]!.dueIso;
	}

	const assignmentSummary: StudentDashboardAssignmentSummary = {
		pendingCount,
		overdueCount,
		completedCount,
		nextDueTitle,
		nextDueIso,
	};

	const headerGreeting = pickStudentDashboardGreeting(profileRow.full_name);

	return {
		headerGreeting,
		performanceStats,
		subjectCards,
		subjectsLoadError: loadError,
		analytics,
		recentTests,
		assignmentSummary,
	};
}
