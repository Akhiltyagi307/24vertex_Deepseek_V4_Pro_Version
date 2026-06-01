import { describe, expect, it } from "vitest";

import { decideReviewEnqueue, REVIEW_PERIOD_SUBBUDGET } from "@/lib/practice/review-selection";

describe("decideReviewEnqueue", () => {
	it("enqueues when under all caps", () => {
		expect(
			decideReviewEnqueue({ testsLeft: 10, reviewTestsThisPeriod: 0, hasReviewActivityToday: false }),
		).toEqual({ enqueue: true, reason: "ok" });
	});

	it("blocks when no quota left", () => {
		expect(
			decideReviewEnqueue({ testsLeft: 0, reviewTestsThisPeriod: 0, hasReviewActivityToday: false }),
		).toEqual({ enqueue: false, reason: "no_quota" });
	});

	it("blocks at the period sub-budget", () => {
		expect(
			decideReviewEnqueue({
				testsLeft: 10,
				reviewTestsThisPeriod: REVIEW_PERIOD_SUBBUDGET,
				hasReviewActivityToday: false,
			}),
		).toEqual({ enqueue: false, reason: "subbudget" });
	});

	it("blocks a second review the same day", () => {
		expect(
			decideReviewEnqueue({ testsLeft: 10, reviewTestsThisPeriod: 1, hasReviewActivityToday: true }),
		).toEqual({ enqueue: false, reason: "daily_cap" });
	});

	it("prioritizes no_quota over other blocks", () => {
		expect(
			decideReviewEnqueue({
				testsLeft: 0,
				reviewTestsThisPeriod: REVIEW_PERIOD_SUBBUDGET,
				hasReviewActivityToday: true,
			}),
		).toEqual({ enqueue: false, reason: "no_quota" });
	});
});
