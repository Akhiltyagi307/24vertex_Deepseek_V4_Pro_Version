import { computeReviewSchedule, type ReviewScheduleState } from "@/lib/practice/review-schedule";

export type TopicRollup = {
	topic_id: string;
	average_score: number;
	n_incorrect: number;
};

export type TrackerPayloadItem = TopicRollup & {
	next_review_at: string | null;
	review_interval_days: number | null;
	review_ease: number | null;
	consecutive_good: number;
};

/**
 * Build the `practice_update_trackers_bulk` jsonb items, advancing each topic's
 * SM-2-lite review schedule from its prior state + this test's topic score. The
 * extra schedule keys are persisted by the bulk RPC in the same atomic write.
 */
export function buildTrackerPayloadItems(args: {
	rollups: TopicRollup[];
	priorByTopic: Map<string, ReviewScheduleState>;
	nowMs: number;
}): TrackerPayloadItem[] {
	const { rollups, priorByTopic, nowMs } = args;
	return rollups.map((row) => {
		const prior = priorByTopic.get(row.topic_id) ?? {
			intervalDays: null,
			ease: null,
			consecutiveGood: 0,
		};
		const schedule = computeReviewSchedule({
			prior,
			topicScore: Number(row.average_score),
			nowMs,
		});
		return {
			topic_id: row.topic_id,
			average_score: row.average_score,
			n_incorrect: row.n_incorrect,
			next_review_at: schedule.nextReviewAt,
			review_interval_days: schedule.intervalDays,
			review_ease: schedule.ease,
			consecutive_good: schedule.consecutiveGood,
		};
	});
}
