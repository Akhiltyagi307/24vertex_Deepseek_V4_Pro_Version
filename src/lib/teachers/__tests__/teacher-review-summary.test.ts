import { describe, expect, it } from "vitest";

import { shapeReviewSummary } from "@/lib/teachers/teacher-review-summary";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

describe("shapeReviewSummary", () => {
	it("counts issued, completed (graded), and overdue (ungraded + older than 2 days)", () => {
		const s = shapeReviewSummary(
			[
				{ status: "graded", testDateMs: NOW - 5 * DAY }, // completed
				{ status: "in_progress", testDateMs: NOW - 3 * DAY }, // overdue
				{ status: "in_progress", testDateMs: NOW - 1 * DAY }, // pending (recent, not overdue)
				{ status: "submitted", testDateMs: NOW - 10 * DAY }, // overdue (ungraded + old)
			],
			NOW,
		);
		expect(s.issued).toBe(4);
		expect(s.completed).toBe(1);
		expect(s.overdue).toBe(2);
	});

	it("returns zeros for an empty roster", () => {
		expect(shapeReviewSummary([], NOW)).toEqual({ issued: 0, completed: 0, overdue: 0 });
	});

	it("does not count a graded test as overdue even if old", () => {
		const s = shapeReviewSummary([{ status: "graded", testDateMs: NOW - 30 * DAY }], NOW);
		expect(s).toEqual({ issued: 1, completed: 1, overdue: 0 });
	});
});
