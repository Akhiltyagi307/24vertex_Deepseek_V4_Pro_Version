/**
 * Student-facing progress buckets for practice-test grading.
 *
 * Grading emits coarse `graded` / `total` counts on the grade job payload (not
 * fine-grained stepKeys). The checklist maps that progress — plus elapsed time
 * when counts are unknown — into 5 stable, monotonic buckets, matching the
 * generation overlay pattern.
 */

export type GradingChecklistBucket = "load" | "score" | "check" | "feedback" | "finish";

export const GRADING_BUCKETS: ReadonlyArray<{
	id: GradingChecklistBucket;
	label: string;
}> = [
	{ id: "load", label: "Loading your responses" },
	{ id: "score", label: "Scoring your answers" },
	{ id: "check", label: "Checking against the answer key" },
	{ id: "feedback", label: "Writing feedback for each question" },
	{ id: "finish", label: "Finalizing your practice report" },
];

export const GRADING_BUCKET_TOTAL = GRADING_BUCKETS.length;

/** 1-based index of the bucket that shows "Graded N of M" while active. */
export const GRADING_PROGRESS_BUCKET_INDEX = 4;

/**
 * Highest completed bucket (1-based). The next bucket is shown as active.
 * Monotonic: callers should use `Math.max` when merging updates.
 */
export function computeGradingDoneThrough(opts: {
	graded: number | null;
	total: number | null;
	elapsedSeconds: number;
}): number {
	const { graded, total, elapsedSeconds } = opts;

	if (total != null && total > 0 && graded != null) {
		const g = Math.min(Math.max(0, graded), total);
		if (g >= total) return GRADING_BUCKET_TOTAL - 1;
		if (g === 0) return 1;
		const ratio = g / total;
		if (ratio < 0.35) return 2;
		if (ratio < 0.75) return 3;
		return 4;
	}

	// No graded/total yet — gentle time-based advance so the list still moves.
	if (elapsedSeconds < 6) return 0;
	if (elapsedSeconds < 18) return 1;
	if (elapsedSeconds < 40) return 2;
	if (elapsedSeconds < 75) return 3;
	return 4;
}
