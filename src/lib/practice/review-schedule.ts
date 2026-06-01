/**
 * SM-2-lite spaced-repetition scheduler for per-topic review.
 *
 * Pure + deterministic: given a topic's prior review state and the latest test
 * score for that topic, return the next review state. No I/O, no clock access
 * (the caller passes `nowMs`) — so it unit-tests exhaustively.
 *
 * SOURCE OF TRUTH for the algorithm. Persisted by passing the result fields as
 * extra keys in each `practice_update_trackers_bulk` jsonb item. See
 * docs/superpowers/specs/2026-06-01-closed-learning-loop-design.md §5.
 */

export const REVIEW_SCHEDULE_CONFIG = {
	/** Score (0–100) at/above which a review counts as a pass. */
	masteryPassPct: 75,
	/** Interval (days) when a topic first enters scheduling. */
	startIntervalDays: 2,
	/** Ease multiplier when a topic first enters scheduling. */
	startEase: 2.0,
	easeMin: 1.3,
	easeMax: 2.6,
	easeStepUp: 0.1,
	easeStepDown: 0.2,
	/** Consecutive passes after which a topic graduates out of scheduling. */
	graduateGoodStreak: 3,
} as const;

const MS_PER_DAY = 86_400_000;

/** Persisted spaced-repetition state for one (student, topic). */
export type ReviewScheduleState = {
	/** Days until next review. `null` ⇒ not actively scheduled. */
	intervalDays: number | null;
	/** SM-2-lite multiplier. `null` ⇒ not actively scheduled. */
	ease: number | null;
	/** Count of consecutive passing reviews. */
	consecutiveGood: number;
};

export type ComputeReviewScheduleInput = {
	prior: ReviewScheduleState;
	/** This test's average score for the topic, 0–100. */
	topicScore: number;
	/** This test's timestamp, ms since epoch (caller-supplied). */
	nowMs: number;
};

export type ReviewScheduleResult = ReviewScheduleState & {
	/** ISO timestamp of the next review, or `null` when unscheduled/graduated. */
	nextReviewAt: string | null;
};

function clampEase(ease: number): number {
	return Math.min(REVIEW_SCHEDULE_CONFIG.easeMax, Math.max(REVIEW_SCHEDULE_CONFIG.easeMin, ease));
}

function dueAt(nowMs: number, intervalDays: number): string {
	return new Date(nowMs + intervalDays * MS_PER_DAY).toISOString();
}

export function computeReviewSchedule(input: ComputeReviewScheduleInput): ReviewScheduleResult {
	const cfg = REVIEW_SCHEDULE_CONFIG;
	const { prior, topicScore, nowMs } = input;
	const passed = topicScore >= cfg.masteryPassPct;
	const wasScheduled = prior.intervalDays != null && prior.ease != null;

	// Passing on a topic that isn't being remediated → nothing to schedule.
	if (!wasScheduled && passed) {
		return { intervalDays: null, ease: null, consecutiveGood: 0, nextReviewAt: null };
	}

	if (!passed) {
		if (!wasScheduled) {
			// ENTER scheduling.
			return {
				intervalDays: cfg.startIntervalDays,
				ease: cfg.startEase,
				consecutiveGood: 0,
				nextReviewAt: dueAt(nowMs, cfg.startIntervalDays),
			};
		}
		// RESET: comes back fast, ease drops.
		const ease = clampEase((prior.ease ?? cfg.startEase) - cfg.easeStepDown);
		return { intervalDays: 1, ease, consecutiveGood: 0, nextReviewAt: dueAt(nowMs, 1) };
	}

	// PASS on a scheduled topic.
	const consecutiveGood = prior.consecutiveGood + 1;
	if (consecutiveGood >= cfg.graduateGoodStreak) {
		// GRADUATE: drop out of active scheduling.
		return { intervalDays: null, ease: null, consecutiveGood, nextReviewAt: null };
	}
	const priorInterval = prior.intervalDays ?? cfg.startIntervalDays;
	const priorEase = prior.ease ?? cfg.startEase;
	const intervalDays = Math.round(priorInterval * priorEase);
	const ease = clampEase(priorEase + cfg.easeStepUp);
	return { intervalDays, ease, consecutiveGood, nextReviewAt: dueAt(nowMs, intervalDays) };
}
