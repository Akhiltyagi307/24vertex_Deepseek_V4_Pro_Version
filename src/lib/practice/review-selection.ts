/**
 * Pure cap/decision logic for the nightly review scheduler. Kept free of I/O so
 * the endpoint stays thin and the caps are exhaustively unit-tested.
 * See docs/superpowers/specs/2026-06-01-closed-learning-loop-design.md §7.
 */

/** Max review tests the scheduler may auto-consume of a student's period quota. */
export const REVIEW_PERIOD_SUBBUDGET = 8;

export type ReviewEnqueueInput = {
	/** Tests remaining in the student's current billing period. */
	testsLeft: number;
	/** Review tests already created this period. */
	reviewTestsThisPeriod: number;
	/** Whether a review test/job already exists for the student today. */
	hasReviewActivityToday: boolean;
};

export type ReviewEnqueueDecision = {
	enqueue: boolean;
	reason: "ok" | "no_quota" | "subbudget" | "daily_cap";
};

export function decideReviewEnqueue(input: ReviewEnqueueInput): ReviewEnqueueDecision {
	if (input.testsLeft <= 0) return { enqueue: false, reason: "no_quota" };
	if (input.reviewTestsThisPeriod >= REVIEW_PERIOD_SUBBUDGET) {
		return { enqueue: false, reason: "subbudget" };
	}
	if (input.hasReviewActivityToday) return { enqueue: false, reason: "daily_cap" };
	return { enqueue: true, reason: "ok" };
}
