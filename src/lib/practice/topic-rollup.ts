/**
 * Maps mean topic score + mistake counts to a single performance_tracker.status (PDR enum).
 * Guardrail: a topic cannot stay "good" if any question was fully incorrect.
 */
export const TOPIC_GOOD_MIN = 75;
export const TOPIC_SATISFACTORY_MIN = 50;

export type TrackerTopicStatus = "good" | "satisfactory" | "bad";

export function deriveTopicTrackerStatus(
	averageScore: number,
	nIncorrect: number,
): TrackerTopicStatus {
	const base: TrackerTopicStatus =
		averageScore >= TOPIC_GOOD_MIN ? "good"
		: averageScore >= TOPIC_SATISFACTORY_MIN ? "satisfactory"
		: "bad";
	if (nIncorrect > 0 && base === "good") {
		return "satisfactory";
	}
	return base;
}

export type TopicRollupRow = {
	topic_id: string;
	topic_name: string;
	average_score: number;
	status: TrackerTopicStatus;
	n_correct: number;
	n_partial: number;
	n_incorrect: number;
	question_ids: string[];
};

export function buildTopicRollups(
	byTopic: Map<
		string,
		{
			topic_name: string;
			scores: number[];
			verdicts: Array<"correct" | "partially_correct" | "incorrect">;
			question_ids: string[];
		}
	>,
): TopicRollupRow[] {
	const rows: TopicRollupRow[] = [];
	for (const [topicId, g] of byTopic) {
		const n = g.scores.length;
		const average_score = n > 0 ? g.scores.reduce((a, b) => a + b, 0) / n : 0;
		let n_correct = 0;
		let n_partial = 0;
		let n_incorrect = 0;
		for (const v of g.verdicts) {
			if (v === "correct") n_correct++;
			else if (v === "partially_correct") n_partial++;
			else n_incorrect++;
		}
		const status = deriveTopicTrackerStatus(average_score, n_incorrect);
		rows.push({
			topic_id: topicId,
			topic_name: g.topic_name,
			average_score,
			status,
			n_correct,
			n_partial,
			n_incorrect,
			question_ids: g.question_ids,
		});
	}
	return rows;
}
