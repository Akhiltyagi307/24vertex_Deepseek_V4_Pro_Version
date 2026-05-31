import { describe, expect, it } from "vitest";

import {
	computeMasteryState,
	formatMasteryStateLabel,
	isMasteryState,
	MASTERY_STATE_LABELS,
} from "@/lib/student/mastery-states";

describe("computeMasteryState", () => {
	it("returns not_started when no tests have been taken", () => {
		expect(
			computeMasteryState({ status: "not_tested", testsTaken: 0, averageScore: null }),
		).toBe("not_started");
		// Defensive: status says tested but the count is zero.
		expect(
			computeMasteryState({ status: "good", testsTaken: 0, averageScore: 90 }),
		).toBe("not_started");
	});

	it("treats not_tested status and missing scores as not_started", () => {
		expect(
			computeMasteryState({ status: "not_tested", testsTaken: 3, averageScore: 80 }),
		).toBe("not_started");
		expect(
			computeMasteryState({ status: "good", testsTaken: 2, averageScore: null }),
		).toBe("not_started");
	});

	it("bands by average score with 50 / 75 thresholds", () => {
		expect(
			computeMasteryState({ status: "bad", testsTaken: 1, averageScore: 49.9 }),
		).toBe("familiar");
		// 50 is the proficient floor (familiar is strictly < 50).
		expect(
			computeMasteryState({ status: "satisfactory", testsTaken: 1, averageScore: 50 }),
		).toBe("proficient");
		expect(
			computeMasteryState({ status: "satisfactory", testsTaken: 2, averageScore: 74.9 }),
		).toBe("proficient");
		// 75 is the mastered floor.
		expect(
			computeMasteryState({ status: "good", testsTaken: 4, averageScore: 75 }),
		).toBe("mastered");
		expect(
			computeMasteryState({ status: "good", testsTaken: 5, averageScore: 100 }),
		).toBe("mastered");
	});

	it("exposes labels and a type guard", () => {
		expect(formatMasteryStateLabel("mastered")).toBe(MASTERY_STATE_LABELS.mastered);
		expect(isMasteryState("proficient")).toBe(true);
		expect(isMasteryState("nope")).toBe(false);
	});
});
