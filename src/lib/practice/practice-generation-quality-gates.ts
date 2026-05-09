import type { PracticeGenerationOutput } from "./generation-schema";

export type PracticeQualityGateFailureCode =
	| "near_duplicate_stems"
	| "topic_concentration";

export type PracticeQualityGateResult =
	| { ok: true }
	| { ok: false; code: PracticeQualityGateFailureCode; message: string; details?: Record<string, number | string> };

const NEAR_DUPLICATE_SIMILARITY_THRESHOLD = 0.9;
const MAX_TOPIC_SHARE = 0.65;

function normalizeStem(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.filter(Boolean);
}

function diceSimilarity(a: string[], b: string[]): number {
	if (a.length === 0 && b.length === 0) return 1;
	if (a.length === 0 || b.length === 0) return 0;
	const aSet = new Set(a);
	const bSet = new Set(b);
	let intersection = 0;
	for (const token of aSet) {
		if (bSet.has(token)) intersection++;
	}
	return (2 * intersection) / (aSet.size + bSet.size);
}

function findNearDuplicatePairCount(questions: PracticeGenerationOutput["questions"]): number {
	let nearDuplicatePairs = 0;
	for (let i = 0; i < questions.length; i++) {
		const a = normalizeStem(questions[i]?.question_text ?? "");
		for (let j = i + 1; j < questions.length; j++) {
			const b = normalizeStem(questions[j]?.question_text ?? "");
			if (diceSimilarity(a, b) >= NEAR_DUPLICATE_SIMILARITY_THRESHOLD) {
				nearDuplicatePairs++;
			}
		}
	}
	return nearDuplicatePairs;
}

export function evaluatePracticeGenerationQuality(
	output: Pick<PracticeGenerationOutput, "questions">,
): PracticeQualityGateResult {
	const questions = output.questions;
	if (questions.length === 0) return { ok: true };

	const nearDuplicatePairs = findNearDuplicatePairCount(questions);
	if (nearDuplicatePairs > 0) {
		return {
			ok: false,
			code: "near_duplicate_stems",
			message: "Generated questions are too similar. Regenerating for better variety.",
			details: { nearDuplicatePairs },
		};
	}

	const byTopic = new Map<string, number>();
	for (const q of questions) {
		byTopic.set(q.topic_id, (byTopic.get(q.topic_id) ?? 0) + 1);
	}
	const maxTopicCount = Math.max(...byTopic.values());
	const maxTopicShare = maxTopicCount / questions.length;
	if (maxTopicShare > MAX_TOPIC_SHARE) {
		return {
			ok: false,
			code: "topic_concentration",
			message: "Generated questions are overly concentrated in one topic. Regenerating for balance.",
			details: { maxTopicShare: Number(maxTopicShare.toFixed(2)) },
		};
	}

	return { ok: true };
}
