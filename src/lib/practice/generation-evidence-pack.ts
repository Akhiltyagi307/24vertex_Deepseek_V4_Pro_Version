import type { PracticeGenerationOutput } from "./generation-schema";
import type { PracticeTopicGrounding } from "./user-message";

export type PracticeTopicEvidenceKind = "content" | "exercise" | "question_bank";

export type PracticeTopicEvidenceItem = {
	ref: string;
	kind: PracticeTopicEvidenceKind;
	text: string;
	source_ref: string | null;
};

export type PracticeTopicEvidencePack = {
	topic_id: string;
	topic_name: string;
	curriculum_hint: {
		unit_name: string;
		chapter_name: string;
		grade: number;
	};
	items: PracticeTopicEvidenceItem[];
};

export type PracticeEvidenceMap = Map<string, PracticeTopicEvidencePack>;

function normalizeEvidenceText(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function clampEvidenceItems(
	entries: Array<{ text: string; source_ref: string | null }>,
	kind: PracticeTopicEvidenceKind,
	topicId: string,
	maxItems: number,
): PracticeTopicEvidenceItem[] {
	const out: PracticeTopicEvidenceItem[] = [];
	for (let i = 0; i < entries.length && out.length < maxItems; i++) {
		const text = normalizeEvidenceText(entries[i]?.text ?? "");
		if (!text) continue;
		out.push({
			ref: `${topicId}:${kind}:${out.length}`,
			kind,
			text,
			source_ref: entries[i]?.source_ref ?? null,
		});
	}
	return out;
}

export function buildPracticeEvidenceMap(
	topicGrounding: PracticeTopicGrounding[],
	limits: { maxContentPerTopic?: number; maxExercisePerTopic?: number; maxQuestionBankPerTopic?: number } = {},
): PracticeEvidenceMap {
	const maxContent = limits.maxContentPerTopic ?? 4;
	const maxExercise = limits.maxExercisePerTopic ?? 3;
	const maxQuestionBank = limits.maxQuestionBankPerTopic ?? 3;
	const map: PracticeEvidenceMap = new Map();

	for (const topic of topicGrounding) {
		const contentItems = clampEvidenceItems(
			topic.content_chunks,
			"content",
			topic.topic_id,
			Math.max(1, maxContent),
		);
		const exerciseItems = clampEvidenceItems(
			topic.exercise_chunks,
			"exercise",
			topic.topic_id,
			Math.max(0, maxExercise),
		);
		const questionBankItems = clampEvidenceItems(
			topic.question_bank_chunks,
			"question_bank",
			topic.topic_id,
			Math.max(0, maxQuestionBank),
		);
		map.set(topic.topic_id, {
			topic_id: topic.topic_id,
			topic_name: topic.topic_name,
			curriculum_hint: {
				unit_name: topic.curriculum_hint.unit_name,
				chapter_name: topic.curriculum_hint.chapter_name,
				grade: topic.curriculum_hint.grade,
			},
			items: [...contentItems, ...exerciseItems, ...questionBankItems],
		});
	}
	return map;
}

export function selectEvidenceByTopicIds(
	evidenceByTopicId: PracticeEvidenceMap,
	topicIds: Iterable<string>,
): PracticeTopicEvidencePack[] {
	const out: PracticeTopicEvidencePack[] = [];
	for (const id of topicIds) {
		const pack = evidenceByTopicId.get(id);
		if (pack) out.push(pack);
	}
	return out;
}

export function selectEvidenceForFailedIndexes(
	evidenceByTopicId: PracticeEvidenceMap,
	questions: PracticeGenerationOutput["questions"],
	failedIndexes: number[],
): PracticeTopicEvidencePack[] {
	const ids = new Set<string>();
	for (const idx of failedIndexes) {
		const q = questions[idx];
		if (q?.topic_id) ids.add(q.topic_id);
	}
	return selectEvidenceByTopicIds(evidenceByTopicId, ids);
}
