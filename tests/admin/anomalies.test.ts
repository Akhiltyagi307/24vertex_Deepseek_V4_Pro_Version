import { describe, expect, it } from "vitest";

import {
	adminLiveTestAnomalyFlags,
	adminPracticeTestAnomalyFlags,
	anomalyAiErrorAnswer,
	anomalyMissingAnswerKey,
	anomalyTooFast,
	anomalyZeroScore,
} from "@/lib/admin/anomalies";

describe("admin anomalies", () => {
	it("tooFast when duration < 5% of limit", () => {
		expect(
			anomalyTooFast({
				durationSeconds: 10,
				timeLimitSeconds: 3600,
				totalScore: null,
				status: "submitted",
			}),
		).toBe(true);
		expect(
			anomalyTooFast({
				durationSeconds: 400,
				timeLimitSeconds: 3600,
				totalScore: null,
				status: "submitted",
			}),
		).toBe(false);
	});

	it("zeroScore on graded with 0", () => {
		expect(
			anomalyZeroScore({
				durationSeconds: 100,
				timeLimitSeconds: 600,
				totalScore: "0",
				status: "graded",
			}),
		).toBe(true);
	});

	it("missing answer key", () => {
		expect(anomalyMissingAnswerKey({ answerKey: {} })).toBe(true);
		expect(anomalyMissingAnswerKey({ answerKey: { a: 1 } })).toBe(false);
	});

	it("ai error prefix", () => {
		expect(anomalyAiErrorAnswer({ aiFeedback: "[error] boom" })).toBe(true);
		expect(anomalyAiErrorAnswer({ aiFeedback: "ok" })).toBe(false);
	});

	it("adminPracticeTestAnomalyFlags aggregates too_fast and zero_score", () => {
		expect(
			adminPracticeTestAnomalyFlags({
				durationSeconds: 10,
				timeLimitSeconds: 3600,
				totalScore: "0",
				status: "graded",
			}).sort(),
		).toEqual(["too_fast", "zero_score"].sort());
	});

	it("adminLiveTestAnomalyFlags adds tab_blur and paused", () => {
		const flags = adminLiveTestAnomalyFlags({
			durationSeconds: 400,
			timeLimitSeconds: 3600,
			totalScore: "80",
			status: "graded",
			tabBlurCount: 5,
			isPaused: true,
		});
		expect(flags).toContain("tab_blur");
		expect(flags).toContain("paused");
		expect(flags).not.toContain("too_fast");
	});
});
