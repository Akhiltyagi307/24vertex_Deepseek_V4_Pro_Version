import "server-only";

import type {
	StudentDashboardRecentTest,
	StudentDashboardSubjectCard,
} from "@/components/student/student-dashboard-view";
import { buildStudentDashboardAnalyticsPayload } from "@/lib/student/dashboard-analytics";
import { buildDashboardPerformanceStats } from "@/lib/student/dashboard-performance-stats";
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
import { logSupabaseError } from "@/lib/server/log-supabase-error";
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
	/** Populated via FK embed (same pattern as `app/student/reports/page.tsx`). */
	subjects?: { id?: string; name?: string | null } | null;
};

function subjectNameFromCompletedTestRow(
	t: DashboardCompletedTestRow,
	enrolledNameBySubjectId: Map<string, string>,
): string {
	const joined = t.subjects?.name;
	if (typeof joined === "string" && joined.trim()) return joined.trim();
	return enrolledNameBySubjectId.get(t.subject_id) ?? "Subject";
}


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
		const base = (opts?.performancePathPrefix ?? "/parent/performance").replace(/\/$/, "");
		const params = new URLSearchParams();
		params.set("subject", subjectId);
		return `${base}?${params.toString()}`;
	}
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
	trackerNeedsHydration: boolean;
};

/**
 * Loads all data required by `StudentDashboardView` (server-only).
 * Keeps `app/student/dashboard/page.tsx` as auth + wiring only.
 */
export async function loadStudentDashboardViewPayload(
	supabase: SupabaseServer,
	userId: string,
	profileRow: StudentDashboardProfileRow,
	opts?: LoadStudentDashboardOptions,
): Promise<StudentDashboardViewPayload> {
	const bundleInput: StudentProfileSubjectsRow = {
		grade: profileRow.grade,
		stream: profileRow.stream,
		elective_subject_id: profileRow.elective_subject_id,
		role: profileRow.role,
	};

	const completedTestSelect = `
		id,
		test_date,
		total_score,
		subject_id,
		duration_seconds,
		time_limit_seconds,
		subjects (
			id,
			name
		)
	`;

	const [bundle, completedTestRes] = await Promise.all([
		loadStudentPerformanceBundle(supabase, userId, bundleInput),
		supabase
			.from("tests")
			.select(completedTestSelect)
			.eq("student_id", userId)
			.eq("is_draft", false)
			.in("status", ["submitted", "graded"])
			.order("test_date", { ascending: false, nullsFirst: false })
			.order("updated_at", { ascending: false }),
	]);

	const { enrolledSubjects, topicCountBySubjectId, rows, loadError, trackerNeedsHydration } = bundle;
	if (completedTestRes.error) {
		logSupabaseError("loadStudentDashboardViewPayload.tests.select", completedTestRes.error, { userId });
	}
	const completedTestRows = completedTestRes.data;

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
			practiceHref: buildSubjectActionHref(c.subjectId, weakTopicIds, opts),
		};
	});

	const subjectNameById = new Map(enrolledSubjects.map((s) => [s.id, s.name]));
	const recentTests: StudentDashboardRecentTest[] = ((completedTestRows ?? []) as DashboardCompletedTestRow[])
		.slice(0, 5)
		.map((t) => ({
			id: t.id,
			subjectName: subjectNameFromCompletedTestRow(t, subjectNameById),
			testDateIso: t.test_date,
			scorePercent: parsePercent(t.total_score),
			durationSeconds: t.duration_seconds,
		}));

	const headerGreeting =
		opts?.viewerRole === "parent"
			? pickParentDashboardGreeting(profileRow.full_name)
			: pickStudentDashboardGreeting(profileRow.full_name);

	return {
		headerGreeting,
		performanceStats,
		subjectCards,
		subjectsLoadError: loadError,
		analytics,
		recentTests,
		trackerNeedsHydration,
	};
}
