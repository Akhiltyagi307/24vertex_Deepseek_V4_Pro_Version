import { describe, expect, it } from "vitest";

import {
	buildTeacherClassInsightPrompt,
	computeInsightFingerprint,
	hasEnoughDataForClassInsight,
	PROMPT_VERSION,
} from "./teacher-class-insight";
import type { TeacherClassPerformanceSummary } from "./teacher-class-performance-summary-types";

const baseSummary: TeacherClassPerformanceSummary = {
	studentsInScope: 5,
	studentsWithRecentScores: 0,
	classAveragePercent: null,
	recentGradedItemsUsed: 0,
	recentWindowSize: 5,
	performanceBands: [],
	upliftOpportunities: [],
};

describe("hasEnoughDataForClassInsight", () => {
	it("is false when no students have recent scores", () => {
		expect(hasEnoughDataForClassInsight(baseSummary)).toBe(false);
	});

	it("is false when the class average is null", () => {
		expect(hasEnoughDataForClassInsight({ ...baseSummary, studentsWithRecentScores: 3 })).toBe(false);
	});

	it("is true once there is a class average and recent scores", () => {
		expect(
			hasEnoughDataForClassInsight({
				...baseSummary,
				studentsWithRecentScores: 3,
				classAveragePercent: 68,
			}),
		).toBe(true);
	});
});

describe("buildTeacherClassInsightPrompt", () => {
	it("names the weak topics and scope in the prompt", () => {
		const { prompt } = buildTeacherClassInsightPrompt(
			{
				...baseSummary,
				studentsWithRecentScores: 3,
				classAveragePercent: 68,
				upliftOpportunities: [
					{
						topicId: "t",
						topicName: "Quadratic Equations",
						subjectName: "Math",
						averagePercent: 52,
						studentsTested: 4,
						testsTaken: 6,
						studentsBelowSupportLine: 3,
					},
				],
			},
			"Grade 9 · Math",
		);
		expect(prompt).toContain("Quadratic Equations");
		expect(prompt).toContain("Grade 9 · Math");
		expect(prompt).toContain("68");
	});
});

describe("computeInsightFingerprint", () => {
	const withData = (
		over: Partial<TeacherClassPerformanceSummary> = {},
	): TeacherClassPerformanceSummary => ({
		...baseSummary,
		studentsWithRecentScores: 4,
		classAveragePercent: 68,
		upliftOpportunities: [
			{
				topicId: "a",
				topicName: "A",
				subjectName: "Math",
				averagePercent: 50,
				studentsTested: 4,
				testsTaken: 6,
				studentsBelowSupportLine: 3,
			},
			{
				topicId: "b",
				topicName: "B",
				subjectName: "Math",
				averagePercent: 60,
				studentsTested: 3,
				testsTaken: 4,
				studentsBelowSupportLine: 2,
			},
		],
		...over,
	});

	it("is deterministic for the same inputs", () => {
		expect(computeInsightFingerprint(withData(), PROMPT_VERSION)).toBe(
			computeInsightFingerprint(withData(), PROMPT_VERSION),
		);
	});

	it("is independent of uplift topic order", () => {
		const ordered = withData();
		const reversed = withData({ upliftOpportunities: [...ordered.upliftOpportunities].reverse() });
		expect(computeInsightFingerprint(reversed, PROMPT_VERSION)).toBe(
			computeInsightFingerprint(ordered, PROMPT_VERSION),
		);
	});

	it("changes when the class average changes", () => {
		expect(computeInsightFingerprint(withData({ classAveragePercent: 69 }), PROMPT_VERSION)).not.toBe(
			computeInsightFingerprint(withData(), PROMPT_VERSION),
		);
	});

	it("changes when a weak topic's score changes", () => {
		const base = withData();
		const changed = withData({
			upliftOpportunities: base.upliftOpportunities.map((topic, index) =>
				index === 0 ? { ...topic, averagePercent: 51 } : topic,
			),
		});
		expect(computeInsightFingerprint(changed, PROMPT_VERSION)).not.toBe(
			computeInsightFingerprint(base, PROMPT_VERSION),
		);
	});

	it("changes when the prompt version bumps", () => {
		expect(computeInsightFingerprint(withData(), PROMPT_VERSION + 1)).not.toBe(
			computeInsightFingerprint(withData(), PROMPT_VERSION),
		);
	});
});
