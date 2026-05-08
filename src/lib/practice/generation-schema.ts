import { z } from "zod";

import type { PracticeQuestionTypeCounts } from "./constants";

const questionTypeSchema = z.enum(["multiple_choice", "fill_in_blank", "short_answer", "long_answer"]);
const difficultyLevelSchema = z.enum(["easy", "medium", "hard"]);

export const practiceAnswerKeySchema = z.object({
	/** MCQ letter, numeric/text answer, etc. — always a string for JSON-schema compatibility */
	correct_answer: z.string(),
	explanation: z.string(),
	common_mistakes: z.array(z.string()),
	related_concept: z.string(),
});

export const practiceQuestionGeneratedSchema = z.object({
	question_number: z.number().int().positive(),
	topic_id: z.string().uuid(),
	topic_name: z.string(),
	question_text: z.string(),
	question_type: questionTypeSchema,
	difficulty_level: difficultyLevelSchema,
	options: z.record(z.string()).nullable(),
	answer_key: practiceAnswerKeySchema,
	estimated_time_seconds: z.number().int().positive(),
});

export const practiceGenerationOutputSchema = z.object({
	questions: z.array(practiceQuestionGeneratedSchema),
	generation_metadata: z.object({
		topic_distribution: z.record(z.number()),
		difficulty_distribution: z.record(z.number()),
		type_distribution: z.record(z.number()),
		adaptation_rationale: z.string(),
	}),
});

export type PracticeGenerationOutput = z.infer<typeof practiceGenerationOutputSchema>;
export type GeneratedPracticeQuestion = z.infer<typeof practiceQuestionGeneratedSchema>;

const practiceQuestionDraftBaseSchema = z.object({
	topic_id: z.string().uuid(),
	topic_name: z.string(),
	question_text: z.string(),
	difficulty_level: difficultyLevelSchema,
	answer_key: practiceAnswerKeySchema,
	estimated_time_seconds: z.number().int().positive(),
});

const practiceGeneratedMultipleChoiceDraftSchema = practiceQuestionDraftBaseSchema.extend({
	options: z.object({
		A: z.string(),
		B: z.string(),
		C: z.string(),
		D: z.string(),
	}),
});

const practiceGeneratedWrittenDraftSchema = practiceQuestionDraftBaseSchema.extend({
	options: z.null().optional(),
});

const PRACTICE_BUCKET_KEYS = ["multiple_choice", "fill_in_blank", "short_answer", "long_answer"] as const;

export type PracticeGenerationBucketKey = (typeof PRACTICE_BUCKET_KEYS)[number];

export function createPracticeGenerationOutputSchema(_expectedTypeCounts: PracticeQuestionTypeCounts) {
	// Per-bucket exact-count enforcement intentionally lives in
	// `validateAndStripGeneration` (returns a friendly "Question mix is off"
	// message). Enforcing it here via `.length(N)` made `generateObject` throw
	// `NoObjectGeneratedError` whenever the model was off by one, surfacing the
	// opaque "did not match the test format" error and bypassing the retry loop.
	return z.object({
		questions_by_type: z.object({
			multiple_choice: z.array(practiceGeneratedMultipleChoiceDraftSchema),
			fill_in_blank: z.array(practiceGeneratedWrittenDraftSchema),
			short_answer: z.array(practiceGeneratedWrittenDraftSchema),
			long_answer: z.array(practiceGeneratedWrittenDraftSchema),
		}),
		generation_metadata: z.object({
			adaptation_rationale: z.string(),
		}),
	});
}

export type PracticeGenerationGroupedOutput = z.infer<ReturnType<typeof createPracticeGenerationOutputSchema>>;

/** Student-safe shape — never includes answer_key. */
export type PublicPracticeQuestion = {
	question_number: number;
	topic_id: string;
	topic_name: string;
	question_text: string;
	question_type: z.infer<typeof questionTypeSchema>;
	difficulty_level: z.infer<typeof difficultyLevelSchema>;
	options: Record<string, string> | null;
	estimated_time_seconds: number;
};

export type PublicGenerationMetadata = PracticeGenerationOutput["generation_metadata"];

export function summarizeGroupedQuestionTypeCounts(
	raw: PracticeGenerationGroupedOutput,
): Record<PracticeGenerationBucketKey, number> {
	return {
		multiple_choice: raw.questions_by_type.multiple_choice.length,
		fill_in_blank: raw.questions_by_type.fill_in_blank.length,
		short_answer: raw.questions_by_type.short_answer.length,
		long_answer: raw.questions_by_type.long_answer.length,
	};
}

export function flattenPracticeGenerationOutput(
	raw: PracticeGenerationGroupedOutput,
): PracticeGenerationOutput {
	const queues: Record<PracticeGenerationBucketKey, GeneratedPracticeQuestion[]> = {
		multiple_choice: raw.questions_by_type.multiple_choice.map((q) => ({
			question_number: 0,
			topic_id: q.topic_id,
			topic_name: q.topic_name,
			question_text: q.question_text,
			question_type: "multiple_choice",
			difficulty_level: q.difficulty_level,
			options: q.options,
			answer_key: q.answer_key,
			estimated_time_seconds: q.estimated_time_seconds,
		})),
		fill_in_blank: raw.questions_by_type.fill_in_blank.map((q) => ({
			question_number: 0,
			topic_id: q.topic_id,
			topic_name: q.topic_name,
			question_text: q.question_text,
			question_type: "fill_in_blank",
			difficulty_level: q.difficulty_level,
			options: null,
			answer_key: q.answer_key,
			estimated_time_seconds: q.estimated_time_seconds,
		})),
		short_answer: raw.questions_by_type.short_answer.map((q) => ({
			question_number: 0,
			topic_id: q.topic_id,
			topic_name: q.topic_name,
			question_text: q.question_text,
			question_type: "short_answer",
			difficulty_level: q.difficulty_level,
			options: null,
			answer_key: q.answer_key,
			estimated_time_seconds: q.estimated_time_seconds,
		})),
		long_answer: raw.questions_by_type.long_answer.map((q) => ({
			question_number: 0,
			topic_id: q.topic_id,
			topic_name: q.topic_name,
			question_text: q.question_text,
			question_type: "long_answer",
			difficulty_level: q.difficulty_level,
			options: null,
			answer_key: q.answer_key,
			estimated_time_seconds: q.estimated_time_seconds,
		})),
	};

	const questions: GeneratedPracticeQuestion[] = [];
	let questionNumber = 1;
	while (PRACTICE_BUCKET_KEYS.some((key) => queues[key].length > 0)) {
		for (const key of PRACTICE_BUCKET_KEYS) {
			const next = queues[key].shift();
			if (!next) continue;
			questions.push({
				...next,
				question_number: questionNumber++,
			});
		}
	}

	return {
		questions,
		generation_metadata: {
			topic_distribution: {},
			difficulty_distribution: {},
			type_distribution: {},
			adaptation_rationale: raw.generation_metadata.adaptation_rationale,
		},
	};
}

function mcqOptionMap(opts: Record<string, string> | null): Map<string, string> | null {
	if (!opts) return null;
	const out = new Map<string, string>();
	for (const [k, v] of Object.entries(opts)) {
		const up = k.trim().toUpperCase();
		if (up.length === 0) continue;
		out.set(up, v);
	}
	for (const k of ["A", "B", "C", "D"]) {
		if (!out.has(k)) return null;
	}
	return out;
}

const SINGLE_LETTER_AD = /^[A-D]$/;

/** Strictly validate that an MCQ `answer_key.correct_answer` is a single letter matching an option. */
function validateMcqAnswerKey(
	correctAnswerRaw: string,
	optionMap: Map<string, string>,
): { ok: true; letter: string } | { ok: false } {
	const normalized = correctAnswerRaw.trim().toUpperCase();
	if (!SINGLE_LETTER_AD.test(normalized)) return { ok: false };
	if (!optionMap.has(normalized)) return { ok: false };
	return { ok: true, letter: normalized };
}

export type ExpectedQuestionMixCounts = PracticeQuestionTypeCounts;

export type ValidateGenerationOptions = {
	/** Phase 3: enforce total duration sanity (sum of estimated_time_seconds). */
	expectedDurationSeconds?: number | null;
	/** Enforce exact per-type counts when set. */
	expectedTypeCounts?: ExpectedQuestionMixCounts | null;
};

/** UUID string compare is case-sensitive in JS; DB IDs are lowercase; models may emit uppercase. */
function normalizePracticeTopicId(id: string): string {
	return id.trim().toLowerCase();
}

const PRACTICE_TYPE_KEYS = PRACTICE_BUCKET_KEYS;

/**
 * Validates coverage, MCQ shape, type mix, and time budget. Returns questions
 * without answer keys. Also normalizes MCQ answer letters and rebuilds
 * `topic_distribution` / `type_distribution` from the actual questions so a
 * misleading claim from the model does not leak through.
 */
export function validateAndStripGeneration(
	raw: PracticeGenerationOutput,
	expectedQuestionCount: number,
	allowedTopicIds: Set<string>,
	opts: ValidateGenerationOptions = {},
):
	| { ok: true; questions: PublicPracticeQuestion[]; generation_metadata: PublicGenerationMetadata }
	| { ok: false; message: string } {
	if (raw.questions.length !== expectedQuestionCount) {
		return {
			ok: false,
			message: `The generator returned ${raw.questions.length} questions; expected ${expectedQuestionCount}. Try again.`,
		};
	}

	const seenNumbers = new Set<number>();
	const topicCounts = new Map<string, number>();
	const typeCounts: Record<(typeof PRACTICE_TYPE_KEYS)[number], number> = {
		multiple_choice: 0,
		fill_in_blank: 0,
		short_answer: 0,
		long_answer: 0,
	};
	const difficultyCounts: Record<"easy" | "medium" | "hard", number> = {
		easy: 0,
		medium: 0,
		hard: 0,
	};
	let totalTime = 0;

	const canonicalTopicIdByNormalized = new Map<string, string>();
	for (const id of allowedTopicIds) {
		canonicalTopicIdByNormalized.set(normalizePracticeTopicId(id), id);
	}
	const allowedNormalized = new Set(canonicalTopicIdByNormalized.keys());

	for (const q of raw.questions) {
		if (seenNumbers.has(q.question_number)) {
			return { ok: false, message: "Duplicate question numbers in generated test. Try again." };
		}
		seenNumbers.add(q.question_number);

		const topicKey = normalizePracticeTopicId(q.topic_id);
		if (!allowedNormalized.has(topicKey)) {
			return {
				ok: false,
				message: "A question referenced a topic that was not in your selection. Try again.",
			};
		}
		q.topic_id = canonicalTopicIdByNormalized.get(topicKey)!;

		if (q.question_type === "multiple_choice") {
			const optionMap = mcqOptionMap(q.options);
			if (!optionMap) {
				return {
					ok: false,
					message: "A multiple-choice question was missing options A–D. Try again.",
				};
			}
			const check = validateMcqAnswerKey(q.answer_key.correct_answer, optionMap);
			if (!check.ok) {
				return {
					ok: false,
					message:
						"A multiple-choice answer key was not a single letter (A–D) matching the options. Try again.",
				};
			}
			q.answer_key.correct_answer = check.letter;
		} else if (q.options != null && Object.keys(q.options).length > 0) {
			return {
				ok: false,
				message: "Non-multiple-choice questions should not include answer options. Try again.",
			};
		}

		topicCounts.set(q.topic_id, (topicCounts.get(q.topic_id) ?? 0) + 1);
		typeCounts[q.question_type]++;
		difficultyCounts[q.difficulty_level]++;
		totalTime += q.estimated_time_seconds;
	}

	// Heuristic fallback for callers that don't provide `expectedTypeCounts`:
	// a test with all questions in a single bucket usually means the model got
	// lazy. When `expectedTypeCounts` IS provided, the per-bucket check below
	// is authoritative — single-type plans (e.g. Math = MCQ-only via
	// `getPracticeQuestionPlanForSubject`) are intentional and must be allowed.
	if (!opts.expectedTypeCounts) {
		const distinctTypes = (Object.values(typeCounts) as number[]).filter((n) => n > 0).length;
		if (distinctTypes < 2) {
			return {
				ok: false,
				message: "The test must include at least two question types. Try generating again.",
			};
		}
	}

	if (opts.expectedTypeCounts) {
		const t = opts.expectedTypeCounts;
		for (const key of PRACTICE_TYPE_KEYS) {
			const got = typeCounts[key];
			const want = t[key];
			if (got !== want) {
				return {
					ok: false,
					message: `Question mix is off: got ${got} ${key}, expected ${want}. Try again.`,
				};
			}
		}
	}

	if (
		opts.expectedDurationSeconds != null &&
		opts.expectedDurationSeconds > 0 &&
		totalTime > 0
	) {
		const lo = opts.expectedDurationSeconds * 0.6;
		const hi = opts.expectedDurationSeconds * 1.2;
		if (totalTime < lo || totalTime > hi) {
			return {
				ok: false,
				message: `Time budget is off: questions sum to ${totalTime}s; target ${opts.expectedDurationSeconds}s. Try again.`,
			};
		}
	}

	const questions: PublicPracticeQuestion[] = raw.questions.map((q) => ({
		question_number: q.question_number,
		topic_id: q.topic_id,
		topic_name: q.topic_name,
		question_text: q.question_text,
		question_type: q.question_type,
		difficulty_level: q.difficulty_level,
		options: q.question_type === "multiple_choice" ? q.options : null,
		estimated_time_seconds: q.estimated_time_seconds,
	}));

	const generation_metadata: PublicGenerationMetadata = {
		topic_distribution: Object.fromEntries(topicCounts),
		difficulty_distribution: difficultyCounts,
		type_distribution: typeCounts,
		adaptation_rationale: raw.generation_metadata?.adaptation_rationale ?? "",
	};

	return { ok: true, questions, generation_metadata };
}
