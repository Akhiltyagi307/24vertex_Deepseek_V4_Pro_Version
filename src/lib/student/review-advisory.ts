import type { SupabaseClient } from "@supabase/supabase-js";

export type AdvisoryReason = "overdue" | "due_soon" | "weak";

export type AdvisoryRow = {
	topicId: string;
	topicName: string;
	averageScore: number | null;
	/** next_review_at as epoch ms, or null if not scheduled. */
	nextReviewAtMs: number | null;
};

export type AdvisoryAction = {
	topicId: string;
	topicName: string;
	reason: AdvisoryReason;
	/** Days until the next review (negative = overdue); null when unscheduled. */
	dueInDays: number | null;
};

const MASTERY_PCT = 75;
const MAX_ACTIONS = 5;
const MS_PER_DAY = 86_400_000;

/**
 * Pure ranking for the "what to do next" advisory: overdue reviews first, then
 * due-soon reviews, then weak unscheduled topics. Mastered, unscheduled topics
 * are excluded. Capped at {@link MAX_ACTIONS}.
 */
export function rankAdvisoryActions(rows: AdvisoryRow[], nowMs: number): AdvisoryAction[] {
	const scored = rows
		.map((r) => {
			const scheduled = r.nextReviewAtMs != null;
			if (scheduled) {
				const due = r.nextReviewAtMs as number;
				const overdue = due <= nowMs;
				return {
					topicId: r.topicId,
					topicName: r.topicName,
					reason: (overdue ? "overdue" : "due_soon") as AdvisoryReason,
					dueInDays: Math.round((due - nowMs) / MS_PER_DAY),
					rank: overdue ? 0 : 1,
				};
			}
			if (r.averageScore != null && r.averageScore < MASTERY_PCT) {
				return {
					topicId: r.topicId,
					topicName: r.topicName,
					reason: "weak" as AdvisoryReason,
					dueInDays: null,
					rank: 2,
				};
			}
			return null;
		})
		.filter((x): x is NonNullable<typeof x> => x !== null)
		.sort((a, b) => a.rank - b.rank || (a.dueInDays ?? 0) - (b.dueInDays ?? 0));
	return scored.slice(0, MAX_ACTIONS).map(({ rank: _rank, ...rest }) => rest);
}

/** Load + rank a student's advisory actions from performance_tracker (+ topic names). */
export async function loadAdvisoryActions(
	supabase: SupabaseClient,
	studentId: string,
	nowMs: number,
): Promise<AdvisoryAction[]> {
	const { data } = await supabase
		.from("performance_tracker")
		.select("topic_id, average_score, next_review_at, topics(name)")
		.eq("student_id", studentId);
	const rows = ((data ?? []) as Array<{
		topic_id: string;
		average_score: number | string | null;
		next_review_at: string | null;
		topics: { name: string } | { name: string }[] | null;
	}>).map((r) => {
		const topic = Array.isArray(r.topics) ? r.topics[0] : r.topics;
		return {
			topicId: r.topic_id,
			topicName: topic?.name ?? "this topic",
			averageScore: r.average_score != null ? Number(r.average_score) : null,
			nextReviewAtMs: r.next_review_at ? new Date(r.next_review_at).getTime() : null,
		};
	});
	return rankAdvisoryActions(rows, nowMs);
}
