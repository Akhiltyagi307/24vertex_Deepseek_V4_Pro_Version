import { describe, expect, it } from "vitest";

import {
	computeRecentClassAverage,
	computeRecentPerformanceBandPerStudent,
	selectUpliftOpportunities,
} from "@/lib/teachers/teacher-class-performance-summary";

describe("teacher class performance summary helpers", () => {
	it("computes a student-weighted class average from each student's latest five graded events", () => {
		const result = computeRecentClassAverage({
			studentIds: ["student-a", "student-b"],
			recentWindowSize: 5,
			events: [
				{ studentId: "student-a", percent: 100, occurredAtMs: 600 },
				{ studentId: "student-a", percent: 90, occurredAtMs: 500 },
				{ studentId: "student-a", percent: 80, occurredAtMs: 400 },
				{ studentId: "student-a", percent: 70, occurredAtMs: 300 },
				{ studentId: "student-a", percent: 60, occurredAtMs: 200 },
				{ studentId: "student-a", percent: 0, occurredAtMs: 100 },
				{ studentId: "student-b", percent: 40, occurredAtMs: 700 },
			],
		});

		expect(result.classAveragePercent).toBe(60);
		expect(result.studentsWithRecentScores).toBe(2);
		expect(result.recentGradedItemsUsed).toBe(6);
	});

	it("returns no class average when no in-scope students have graded work", () => {
		const result = computeRecentClassAverage({
			studentIds: ["student-a", "student-b"],
			recentWindowSize: 5,
			events: [],
		});

		expect(result.classAveragePercent).toBeNull();
		expect(result.studentsWithRecentScores).toBe(0);
		expect(result.recentGradedItemsUsed).toBe(0);
	});

	it("maps each student to a band from their own recent average window", () => {
		const map = computeRecentPerformanceBandPerStudent({
			studentIds: ["student-strong", "student-near", "student-empty"],
			recentWindowSize: 5,
			events: [
				{ studentId: "student-strong", percent: 95, occurredAtMs: 500 },
				{ studentId: "student-near", percent: 80, occurredAtMs: 500 },
			],
		});
		expect(map.get("student-strong")).toBe("strong");
		expect(map.get("student-near")).toBe("near_target");
		expect(map.get("student-empty")).toBeNull();
	});

	it("groups students into performance bands from their recent average", () => {
		const result = computeRecentClassAverage({
			studentIds: ["student-strong", "student-near", "student-support", "student-risk", "student-empty"],
			studentProfiles: [
				{ id: "student-strong", fullName: "Strong Student", grade: 8, section: "A" },
				{ id: "student-near", fullName: "Near Target", grade: 8, section: "A" },
				{ id: "student-support", fullName: "Needs Support", grade: 8, section: "B" },
				{ id: "student-risk", fullName: "At Risk", grade: 8, section: "B" },
			],
			recentWindowSize: 5,
			events: [
				{ studentId: "student-strong", percent: 95, occurredAtMs: 500 },
				{ studentId: "student-near", percent: 82, occurredAtMs: 500 },
				{ studentId: "student-support", percent: 66, occurredAtMs: 500 },
				{ studentId: "student-risk", percent: 55, occurredAtMs: 500 },
			],
		});

		expect(result.performanceBands.map((band) => [band.id, band.count])).toEqual([
			["strong", 1],
			["near_target", 1],
			["needs_support", 1],
			["at_risk", 1],
		]);
		expect(result.performanceBands[2]?.students).toEqual([
			{
				studentId: "student-support",
				fullName: "Needs Support",
				grade: 8,
				section: "B",
				averagePercent: 66,
				recentGradedItemsUsed: 1,
			},
		]);
	});

	it("returns up to five weakest topics, preferring broad low performers over one-student outliers", () => {
		const opportunities = selectUpliftOpportunities({
			studentsInScope: 10,
			supportLinePercent: 60,
			topics: [
				{
					topicId: "topic-outlier",
					topicName: "Very small sample",
					subjectName: "Mathematics",
					averagePercent: 20,
					studentsTested: 1,
					testsTaken: 1,
					studentsBelowSupportLine: 1,
				},
				{
					topicId: "topic-broad",
					topicName: "Fractions word problems",
					subjectName: "Mathematics",
					averagePercent: 52,
					studentsTested: 7,
					testsTaken: 14,
					studentsBelowSupportLine: 5,
				},
				{
					topicId: "topic-okay",
					topicName: "Number patterns",
					subjectName: "Mathematics",
					averagePercent: 74,
					studentsTested: 9,
					testsTaken: 18,
					studentsBelowSupportLine: 1,
				},
				{
					topicId: "topic-second",
					topicName: "Linear equations",
					subjectName: "Mathematics",
					averagePercent: 48,
					studentsTested: 6,
					testsTaken: 12,
					studentsBelowSupportLine: 4,
				},
				{
					topicId: "topic-third",
					topicName: "Quadratic roots",
					subjectName: "Mathematics",
					averagePercent: 55,
					studentsTested: 5,
					testsTaken: 10,
					studentsBelowSupportLine: 3,
				},
				{
					topicId: "topic-fourth",
					topicName: "Trigonometry ratios",
					subjectName: "Mathematics",
					averagePercent: 58,
					studentsTested: 4,
					testsTaken: 8,
					studentsBelowSupportLine: 2,
				},
				{
					topicId: "topic-fifth",
					topicName: "Coordinate geometry",
					subjectName: "Mathematics",
					averagePercent: 61,
					studentsTested: 3,
					testsTaken: 6,
					studentsBelowSupportLine: 1,
				},
				{
					topicId: "topic-sixth",
					topicName: "Statistics basics",
					subjectName: "Mathematics",
					averagePercent: 63,
					studentsTested: 3,
					testsTaken: 6,
					studentsBelowSupportLine: 0,
				},
			],
		});

		expect(opportunities).toHaveLength(5);
		expect(opportunities[0]?.topicId).toBe("topic-second");
		expect(opportunities.map((topic) => topic.topicId)).toContain("topic-broad");
		expect(opportunities.map((topic) => topic.topicId)).not.toContain("topic-outlier");
	});
});
