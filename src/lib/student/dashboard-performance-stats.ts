import {
	addCalendarDaysToAppTimeZoneDateKey,
	appTimeZoneDateKey,
} from "@/lib/datetime/app-timezone";
import type { PerformanceRowSerialized } from "@/lib/student/performance-matrix";

export type DashboardPerformanceStats = {
	testsCompleted: number;
	averageScoreLast30Days: number | null;
	/** Topics in the performance tracker with `good` status. */
	topicsMasteredCount: number;
	/** Topics tracked but still not in `good` state. */
	topicsNeedingImprovementCount: number;
	studyStreakDays: number;
	/** Sum of completed-test durations in the last 30 days, rounded. */
	timeSpentMinutesLast30Days: number;
};

export type CompletedTestRow = {
	test_date: string | null;
	total_score?: string | number | null;
	duration_seconds?: number | null;
};

/** Calendar-day lookback for study-streak KPI (test_date only). Streaks longer than this may under-count. */
export const DASHBOARD_STREAK_LOOKBACK_DAYS = 400;

export type DashboardCompletedTestInput = {
	testsCompleted: number;
	recentTests: CompletedTestRow[];
	streakTestDates: CompletedTestRow[];
};

export function dashboardStatsWindowKeys(now: Date = new Date()): {
	endKey: string;
	startKey30: string;
	streakStartKey: string;
} {
	const endKey = appTimeZoneDateKey(now);
	return {
		endKey,
		startKey30: addCalendarDaysToAppTimeZoneDateKey(endKey, -29),
		streakStartKey: addCalendarDaysToAppTimeZoneDateKey(endKey, -DASHBOARD_STREAK_LOOKBACK_DAYS),
	};
}

/** Start of calendar day in IST as ISO (for Supabase `gte` on timestamptz). */
export function dateKeyToIsoStartInAppTz(dateKey: string): string {
	const [y, m, d] = dateKey.split("-").map(Number);
	if (!y || !m || !d) return dateKey;
	return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00+05:30`;
}

/** yyyy-MM-dd in India (Asia/Kolkata); safe on UTC servers and in the browser. */
export function localDateKey(d: Date): string {
	return appTimeZoneDateKey(d);
}

/** Consecutive calendar days (IST) with at least one completed test, counting backward from today or yesterday. */
export function computeStudyStreakDays(testDatesIso: string[]): number {
	const keys = new Set<string>();
	for (const iso of testDatesIso) {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) continue;
		keys.add(localDateKey(d));
	}
	if (keys.size === 0) return 0;

	let curKey = appTimeZoneDateKey(new Date());
	if (!keys.has(curKey)) {
		curKey = addCalendarDaysToAppTimeZoneDateKey(curKey, -1);
	}
	let streak = 0;
	while (keys.has(curKey)) {
		streak += 1;
		curKey = addCalendarDaysToAppTimeZoneDateKey(curKey, -1);
	}
	return streak;
}

function parseScore(v: string | number | null | undefined): number | null {
	if (v == null || v === "") return null;
	const n = typeof v === "number" ? v : Number.parseFloat(String(v));
	return Number.isFinite(n) ? n : null;
}

export function buildDashboardPerformanceStats(
	trackerRows: PerformanceRowSerialized[],
	input: DashboardCompletedTestInput,
	referenceDate: Date = new Date(),
): DashboardPerformanceStats {
	const { testsCompleted, recentTests, streakTestDates } = input;

	const { endKey, startKey30 } = dashboardStatsWindowKeys(referenceDate);
	const recentScores: number[] = [];
	for (const t of recentTests) {
		if (!t.test_date) continue;
		const td = new Date(t.test_date);
		if (Number.isNaN(td.getTime())) continue;
		const tk = localDateKey(td);
		if (tk < startKey30 || tk > endKey) continue;
		const sc = parseScore(t.total_score);
		if (sc != null) recentScores.push(sc);
	}
	const averageScoreLast30Days =
		recentScores.length > 0
			? Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length)
			: null;

	const topicsMasteredCount = trackerRows.filter((r) => r.status === "good").length;
	const topicsNeedingImprovementCount = trackerRows.filter((r) => r.status !== "good").length;

	const streakDates = streakTestDates.map((t) => t.test_date).filter((d): d is string => Boolean(d));
	const studyStreakDays = computeStudyStreakDays(streakDates);

	let timeSpentMinutesLast30Days = 0;
	for (const t of recentTests) {
		if (!t.test_date || t.duration_seconds == null || t.duration_seconds <= 0) continue;
		const td = new Date(t.test_date);
		if (Number.isNaN(td.getTime())) continue;
		const tk = localDateKey(td);
		if (tk < startKey30 || tk > endKey) continue;
		timeSpentMinutesLast30Days += t.duration_seconds / 60;
	}
	timeSpentMinutesLast30Days = Math.round(timeSpentMinutesLast30Days);

	return {
		testsCompleted,
		averageScoreLast30Days,
		topicsMasteredCount,
		topicsNeedingImprovementCount,
		studyStreakDays,
		timeSpentMinutesLast30Days,
	};
}
