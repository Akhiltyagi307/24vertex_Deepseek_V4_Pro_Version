import { describe, expect, it } from "vitest";

import { computeGradingDoneThrough } from "./grading-progress-buckets";

describe("computeGradingDoneThrough", () => {
	it("advances by graded ratio when counts are known", () => {
		expect(computeGradingDoneThrough({ graded: 0, total: 10, elapsedSeconds: 0 })).toBe(1);
		expect(computeGradingDoneThrough({ graded: 2, total: 10, elapsedSeconds: 0 })).toBe(2);
		expect(computeGradingDoneThrough({ graded: 6, total: 10, elapsedSeconds: 0 })).toBe(3);
		expect(computeGradingDoneThrough({ graded: 9, total: 10, elapsedSeconds: 0 })).toBe(4);
		expect(computeGradingDoneThrough({ graded: 10, total: 10, elapsedSeconds: 0 })).toBe(4);
	});

	it("falls back to elapsed time when counts are unknown", () => {
		expect(computeGradingDoneThrough({ graded: null, total: null, elapsedSeconds: 0 })).toBe(0);
		expect(computeGradingDoneThrough({ graded: null, total: null, elapsedSeconds: 25 })).toBe(2);
	});
});
