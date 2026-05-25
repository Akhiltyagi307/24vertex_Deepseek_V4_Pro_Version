import "server-only";

import type { SubjectTopicRadarDatum } from "@/lib/charts/subject-topic-radar-config";
import type { StudentDashboardSubjectCard } from "@/components/student/student-dashboard-view";
import type { StudentAssignmentCard } from "@/lib/assignments/student-assignment-card";
import { buildStudentDashboardLeaderboardPayload } from "@/lib/student/dashboard-leaderboard.server";
import type { StudentDashboardLeaderboardPayload } from "@/lib/student/dashboard-leaderboard";
import { listOpenStudentAssignments } from "@/lib/student/dashboard-open-assignments.server";
import { buildDashboardPerformanceStats } from "@/lib/student/dashboard-performance-stats";
import { loadDashboardCompletedTestInput } from "@/lib/student/load-dashboard-test-stats";
import {
	pickParentDashboardGreeting,
	pickStudentDashboardGreeting,
} from "@/lib/student/dashboard-greeting";
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
	organization_id: string | null;
};

function statusPriority(status: "good" | "satisfactory" | "bad" | "not_tested"): number {
	if (status === "bad") return 0;
	if (status === "satisfactory") return 1;
	if (status === "not_tested") return 2;
	return 3;
}

export type LoadStudentDashboardOptions = {
	/** Default: student practice deep-links. Parent portal links to performance instead. */
	subjectCardLinkMode?: "practice" | "performance";
	/** Base path for performance links when `subjectCardLinkMode === "performance"` (default `/parent/performance`). */
	performancePathPrefix?: string;
	/** Parent portal uses guardian-focused greetings and labels in shared dashboard UI. */
	viewerRole?: "student" | "parent";
};

function buildSubjectActionHref(
	subjectId: string,
	topicIds: string[],
	opts?: LoadStudentDashboardOptions,
): string {
	const mode = opts?.subjectCardLinkMode ?? "practice";
	if (mode === "performance") {
		return buildPerformanceSubjectHref(subjectId, opts);
	}
	const params = new URLSearchParams();
	params.set("subjectId", subjectId);
	if (topicIds.length) {
		params.set("topicIds", topicIds.join(","));
	}
	return `/student/practice?${params.toString()}`;
}

function buildPerformanceSubjectHref(subjectId: string, opts?: LoadStudentDashboardOptions): string {
	const isParentPerformance =
		opts?.subjectCardLinkMode === "performance" || opts?.viewerRole === "parent";
	const base = isParentPerformance
		? (opts?.performancePathPrefix ?? "/parent/performance").replace(/\/$/, "")
		: "/student/performance";
	const params = new URLSearchParams();
	params.set("subject", subjectId);
	return `${base}?${params.toString()}#perf-topic-matrix`;
}

export type StudentDashboardCorePayload = {
	headerGreeting: string;
	performanceStats: ReturnType<typeof buildDashboardPerformanceStats>;
	subjectCards: StudentDashboardSubjectCard[];
	/** Per enrolled subject: curriculum coverage vs solid topics (same series as marketing radar). */
	topicProgressRadar: SubjectTopicRadarDatum[];
	subjectsLoadError: string | null;
	openAssignments: StudentAssignmentCard[];
	trackerNeedsHydration: boolean;
	/** For deferred leaderboard load (Suspense). */
	enrolledSubjects: { id: string; name: string }[];
};

export type StudentDashboardViewPayload = StudentDashboardCorePayload & {
	leaderboard: StudentDashboardLeaderboardPayload;
};

/**
 * Core dashboard data (excludes leaderboard for streaming).
 */
export async function loadStudentDashboardCorePayload(
	supabase: SupabaseServer,
	userId: string,
	profileRow: StudentDashboardProfileRow,
	opts?: LoadStudentDashboardOptions,
): Promise<StudentDashboardCorePayload> {
	const bundleInput: StudentProfileSubjectsRow = {
		grade: profileRow.grade,
		stream: profileRow.stream,
		elective_subject_id: profileRow.elective_subject_id,
		role: profileRow.role,
	};

	const [bundle, completedTestInput, openAssignments] = await Promise.all([
		loadStudentPerformanceBundle(supabase, userId, bundleInput),
		loadDashboardCompletedTestInput(supabase, userId),
		listOpenStudentAssignments(userId),
	]);

	const { enrolledSubjects, topicCountBySubjectId, rows, loadError, trackerNeedsHydration } = bundle;

	const performanceStats = buildDashboardPerformanceStats(rows, completedTestInput);

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
			practiceHref: buildSubjectActionHref(c.subjectId, weakTopicIds, opts),
			performanceHref: buildPerformanceSubjectHref(c.subjectId, opts),
			topicStatusCounts:
				st.trackedCount > 0
					? {
							good: st.good,
							satisfactory: st.satisfactory,
							bad: st.bad,
							notTested: st.notTested,
						}
					: undefined,
		};
	});

	const topicProgressRadar: SubjectTopicRadarDatum[] = enrolledSubjectCards.map((c) => {
		const st = trackerMap.get(c.subjectId) ?? emptySubjectCardTrackerStats;
		const topicTotal = c.topicTotal;
		const coverage = c.percentCovered;
		const perfected = topicTotal ? Math.round((st.good / topicTotal) * 100) : 0;
		return { subject: c.subjectName, coverage, perfected };
	});

	const headerGreeting =
		opts?.viewerRole === "parent"
			? pickParentDashboardGreeting(profileRow.full_name)
			: pickStudentDashboardGreeting(profileRow.full_name);

	return {
		headerGreeting,
		performanceStats,
		subjectCards,
		topicProgressRadar,
		subjectsLoadError: loadError,
		openAssignments,
		trackerNeedsHydration,
		enrolledSubjects: enrolledSubjects.map((s) => ({ id: s.id, name: s.name })),
	};
}

export async function loadStudentDashboardLeaderboardOnly(params: {
	studentId: string;
	organizationId: string | null;
	enrolledSubjects: { id: string; name: string }[];
}): Promise<StudentDashboardLeaderboardPayload> {
	return buildStudentDashboardLeaderboardPayload(params);
}

/**
 * Loads all data required by `StudentDashboardView` (server-only), including leaderboard.
 */
export async function loadStudentDashboardViewPayload(
	supabase: SupabaseServer,
	userId: string,
	profileRow: StudentDashboardProfileRow,
	opts?: LoadStudentDashboardOptions,
): Promise<StudentDashboardViewPayload> {
	const core = await loadStudentDashboardCorePayload(supabase, userId, profileRow, opts);
	const leaderboard = await loadStudentDashboardLeaderboardOnly({
		studentId: userId,
		organizationId: profileRow.organization_id,
		enrolledSubjects: core.enrolledSubjects,
	});
	return { ...core, leaderboard };
}
