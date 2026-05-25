import { describe, expect, it } from "vitest";

import {
	buildDashboardPerformanceStats,
	computeStudyStreakDays,
	dashboardStatsWindowKeys,
} from "@/lib/student/dashboard-performance-stats";

describe("buildDashboardPerformanceStats", () => {
	const now = new Date("2026-05-21T12:00:00Z");
	const { startKey30 } = dashboardStatsWindowKeys(now);

	it("uses lifetime count separate from recent row payloads", () => {
		const stats = buildDashboardPerformanceStats(
			[],
			{
				testsCompleted: 42,
				recentTests: [
					{
						test_date: `${startKey30}T10:00:00+05:30`,
						total_score: "80",
						duration_seconds: 600,
					},
				],
				streakTestDates: [{ test_date: `${startKey30}T10:00:00+05:30`, total_score: null }],
			},
			now,
		);
		expect(stats.testsCompleted).toBe(42);
		expect(stats.averageScoreLast30Days).toBe(80);
		expect(stats.timeSpentMinutesLast30Days).toBe(10);
	});

	it("ignores tests outside the 30-day window for average score", () => {
		const stats = buildDashboardPerformanceStats(
			[],
			{
				testsCompleted: 2,
				recentTests: [
					{ test_date: "2020-01-01T10:00:00+05:30", total_score: "50", duration_seconds: 60 },
					{
						test_date: `${startKey30}T10:00:00+05:30`,
						total_score: "90",
						duration_seconds: 120,
					},
				],
				streakTestDates: [],
			},
			now,
		);
		expect(stats.averageScoreLast30Days).toBe(90);
	});

	it("computes streak from streakTestDates only", () => {
		const stats = buildDashboardPerformanceStats(
			[],
			{
				testsCompleted: 1,
				recentTests: [],
				streakTestDates: [
					{ test_date: "2026-05-21T08:00:00+05:30", total_score: null },
					{ test_date: "2026-05-20T08:00:00+05:30", total_score: null },
				],
			},
			now,
		);
		expect(stats.studyStreakDays).toBe(computeStudyStreakDays(["2026-05-21T08:00:00+05:30", "2026-05-20T08:00:00+05:30"]));
	});
});
