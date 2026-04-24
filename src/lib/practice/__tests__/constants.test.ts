import { describe, expect, it } from "vitest";

import { getPracticeQuestionPlan } from "../constants";

describe("getPracticeQuestionPlan", () => {
	it("returns the 1-hour plan", () => {
		const p = getPracticeQuestionPlan(3600);
		expect(p.total).toBe(15);
		expect(p.counts).toEqual({
			multiple_choice: 5,
			fill_in_blank: 5,
			short_answer: 3,
			long_answer: 2,
		});
	});

	it("returns the 3-hour plan", () => {
		const p = getPracticeQuestionPlan(10800);
		expect(p.total).toBe(30);
		expect(p.counts).toEqual({
			multiple_choice: 10,
			fill_in_blank: 10,
			short_answer: 6,
			long_answer: 4,
		});
	});

	it("throws for unsupported durations", () => {
		expect(() => getPracticeQuestionPlan(1800)).toThrow();
	});
});
