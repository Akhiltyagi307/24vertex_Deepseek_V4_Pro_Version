import { describe, expect, it } from "vitest";

import {
	buildHeatmapDays,
	buildKpi,
	buildStudentDashboardAnalyticsPayload,
	buildSubjectBars,
	buildTopicStatusDistribution,
	buildTrendSeries,
	findFocusSubject,
	serializeCompletedTestsForAnalytics,
	type AnalyticsTestRow,
} from "@/lib/student/dashboard-analytics";
import type { PerformanceRowSerialized } from "@/lib/student/performance-matrix";

const fixedEnd = new Date(2026, 3, 18); // Apr 18 2026 local

function row(
	partial: Partial<PerformanceRowSerialized> & Pick<PerformanceRowSerialized, "trackerId" | "topicId" | "subjectId">,
): PerformanceRowSerialized {
	return {
		status: "not_tested",
		lastTestDate: null,
		averageScore: null,
		testsTaken: 0,
		trend: "stable",
		updatedAt: "",
		topicName: "",
		unitName: "",
		unitNumber: 0,
		chapterName: "",
		chapterNumber: 0,
		topicNumber: 0,
		grade: 10,
		subjectName: "",
		subjectGroup: null,
		subjectSortOrder: 0,
		...partial,
	};
}

describe("buildTopicStatusDistribution", () => {
	it("counts tracker statuses", () => {
		const d = buildTopicStatusDistribution([
			row({ trackerId: "1", topicId: "t1", subjectId: "s1", status: "good" }),
			row({ trackerId: "2", topicId: "t2", subjectId: "s1", status: "satisfactory" }),
			row({ trackerId: "3", topicId: "t3", subjectId: "s1", status: "bad" }),
			row({ trackerId: "4", topicId: "t4", subjectId: "s1", status: "not_tested" }),
		]);
		expect(d).toEqual({ good: 1, satisfactory: 1, bad: 1, notTested: 1 });
	});
});

describe("serializeCompletedTestsForAnalytics", () => {
	it("trims to maxDaysBack", () => {
		const recent = new Date(2026, 3, 10, 15, 0, 0);
		const old = new Date(2026, 0, 5, 15, 0, 0);
		const raw = [
			{ test_date: recent.toISOString(), total_score: 80, subject_id: "s1", duration_seconds: 60 },
			{ test_date: old.toISOString(), total_score: 70, subject_id: "s1", duration_seconds: null },
		];
		const out = serializeCompletedTestsForAnalytics(raw, { maxDaysBack: 30, end: fixedEnd });
		expect(out.length).toBe(1);
		expect(out[0].score).toBe(80);
	});
});

describe("buildTrendSeries", () => {
	it("fills every day in range and averages scores", () => {
		const tests: AnalyticsTestRow[] = [
			{ dateKey: "2026-04-16", score: 80, subjectId: "s1", durationSec: null },
			{ dateKey: "2026-04-16", score: 60, subjectId: "s1", durationSec: null },
			{ dateKey: "2026-04-17", score: null, subjectId: "s1", durationSec: null },
		];
		const series = buildTrendSeries(tests, 7, fixedEnd);
		expect(series.length).toBe(7);
		const apr16 = series.find((p) => p.dateKey === "2026-04-16");
		expect(apr16?.testCount).toBe(2);
		expect(apr16?.avgScore).toBe(70);
		const apr17 = series.find((p) => p.dateKey === "2026-04-17");
		expect(apr17?.testCount).toBe(1);
		expect(apr17?.avgScore).toBeNull();
	});
});

describe("buildSubjectBars", () => {
	it("includes enrolled subjects with zero tests", () => {
		const tests: AnalyticsTestRow[] = [];
		const bars = buildSubjectBars(tests, { s1: "Math", s2: "Science" }, 30, fixedEnd);
		expect(bars).toHaveLength(2);
		expect(bars.every((b) => b.testCount === 0 && b.avgScore == null)).toBe(true);
	});

	it("computes per-subject averages in range", () => {
		const tests: AnalyticsTestRow[] = [
			{ dateKey: "2026-04-17", score: 90, subjectId: "s1", durationSec: null },
			{ dateKey: "2026-04-17", score: 70, subjectId: "s2", durationSec: null },
		];
		const bars = buildSubjectBars(tests, { s1: "Math", s2: "Science" }, 30, fixedEnd);
		const math = bars.find((b) => b.subjectId === "s1");
		const sci = bars.find((b) => b.subjectId === "s2");
		expect(math?.avgScore).toBe(90);
		expect(sci?.avgScore).toBe(70);
	});
});

describe("findFocusSubject", () => {
	it("picks lowest scored subject among those with scores", () => {
		const f = findFocusSubject([
			{ subjectId: "s1", label: "Math", avgScore: 90, testCount: 1 },
			{ subjectId: "s2", label: "Science", avgScore: 55, testCount: 2 },
		]);
		expect(f?.subjectName).toBe("Science");
		expect(f?.avgScore).toBe(55);
	});
});

describe("buildStudentDashboardAnalyticsPayload", () => {
	it("builds payload shape", () => {
		const p = buildStudentDashboardAnalyticsPayload(
			[
				{
					test_date: new Date(2026, 3, 17, 12, 0, 0).toISOString(),
					total_score: "82",
					subject_id: "s1",
					duration_seconds: 120,
				},
			],
			[row({ trackerId: "1", topicId: "t1", subjectId: "s1", status: "good" })],
			[{ id: "s1", name: "Math" }],
			{ end: fixedEnd },
		);
		expect(p.tests).toHaveLength(1);
		expect(p.tests[0].score).toBe(82);
		expect(p.distribution.good).toBe(1);
		expect(p.subjectNames.s1).toBe("Math");
	});
});

describe("buildHeatmapDays", () => {
	it("aggregates counts in window", () => {
		const tests: AnalyticsTestRow[] = [
			{ dateKey: "2026-04-17", score: 80, subjectId: "s1", durationSec: 120 },
			{ dateKey: "2026-04-17", score: 70, subjectId: "s1", durationSec: 60 },
		];
		const days = buildHeatmapDays(tests, 2, fixedEnd);
		expect(days.length).toBe(14);
		const hit = days.find((d) => d.dateKey === "2026-04-17");
		expect(hit?.count).toBe(2);
		expect(hit?.minutes).toBe(3);
	});
});

describe("buildKpi", () => {
	it("returns averages for slice", () => {
		const tests: AnalyticsTestRow[] = [
			{ dateKey: "2026-04-17", score: 80, subjectId: "s1", durationSec: null },
			{ dateKey: "2026-04-17", score: 60, subjectId: "s1", durationSec: null },
		];
		const k = buildKpi(tests, 7, fixedEnd);
		expect(k.testCount).toBe(2);
		expect(k.avgScore).toBe(70);
	});
});
