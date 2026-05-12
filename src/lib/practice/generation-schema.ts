import { z } from "zod";

import type { PracticeQuestionTypeCounts } from "./constants";
import { questionVisualEnvelopeSchema } from "./visuals/schemas";

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
	/**
	 * Optional visual envelope — see `src/lib/practice/visuals/schemas.ts`.
	 * Default is `null`; the model emits a non-null envelope only when the
	 * question is genuinely load-bearing on the figure (per the Visuals
	 * discipline block in the system prompt).
	 */
	visual: questionVisualEnvelopeSchema.nullable(),
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

function createPracticeQuestionDraftBaseSchema(visualsEnabled: boolean) {
	return z.object({
		topic_id: z.string().uuid(),
		topic_name: z.string(),
		question_text: z.string(),
		difficulty_level: difficultyLevelSchema,
		answer_key: practiceAnswerKeySchema,
		estimated_time_seconds: z.number().int().positive(),
		// When visuals are disabled for this generation request, enforce explicit nulls
		// so the model is not burdened by the large visual union schema.
		visual:
			visualsEnabled ?
				questionVisualEnvelopeSchema.nullable()
			:	z.null(),
	});
}

const PRACTICE_BUCKET_KEYS = ["multiple_choice", "fill_in_blank", "short_answer", "long_answer"] as const;

export type PracticeGenerationBucketKey = (typeof PRACTICE_BUCKET_KEYS)[number];

export function createPracticeGenerationOutputSchema(
	expectedTypeCounts: PracticeQuestionTypeCounts,
	options?: { visualsEnabled?: boolean },
) {
	const visualsEnabled = options?.visualsEnabled !== false;
	const practiceQuestionDraftBaseSchema = createPracticeQuestionDraftBaseSchema(visualsEnabled);
	const practiceGeneratedMultipleChoiceDraftSchema = practiceQuestionDraftBaseSchema.extend({
		options: z.object({
			A: z.string(),
			B: z.string(),
			C: z.string(),
			D: z.string(),
		}),
	});

	/** `options` must be explicit `null` (not omitted). OpenAI strict structured outputs require every object `property` to appear in `required`; optional keys break generation with invalid_json_schema. */
	const practiceGeneratedWrittenDraftSchema = practiceQuestionDraftBaseSchema.extend({
		options: z.null(),
	});

	return z.object({
		questions_by_type: z.object({
			multiple_choice: z
				.array(practiceGeneratedMultipleChoiceDraftSchema)
				.length(expectedTypeCounts.multiple_choice),
			fill_in_blank: z
				.array(practiceGeneratedWrittenDraftSchema)
				.length(expectedTypeCounts.fill_in_blank),
			short_answer: z.array(practiceGeneratedWrittenDraftSchema).length(expectedTypeCounts.short_answer),
			long_answer: z.array(practiceGeneratedWrittenDraftSchema).length(expectedTypeCounts.long_answer),
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
	visual: z.infer<typeof questionVisualEnvelopeSchema> | null;
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

/** Sum of per-question times after coercing invalid values to a safe default. */
export function sumGroupedEstimatedSeconds(raw: PracticeGenerationGroupedOutput): number {
	let s = 0;
	for (const k of PRACTICE_BUCKET_KEYS) {
		for (const q of raw.questions_by_type[k]) {
			const t = Number(q.estimated_time_seconds);
			s += Number.isFinite(t) && t >= 1 ? Math.round(t) : 60;
		}
	}
	return s;
}

/**
 * Scales every question's `estimated_time_seconds` so the total lies in
 * [0.6 × duration, 1.2 × duration], matching {@link validateAndStripGeneration}.
 * Coerces missing or non-positive values to 60 before scaling. Idempotent when
 * the sum is already in range.
 */
export function normalizeGroupedEstimatedTimesToPlan(
	raw: PracticeGenerationGroupedOutput,
	durationSeconds: number,
): PracticeGenerationGroupedOutput {
	if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
		return structuredClone(raw) as PracticeGenerationGroupedOutput;
	}
	const lo = durationSeconds * 0.6;
	const hi = durationSeconds * 1.2;
	const clone = structuredClone(raw) as PracticeGenerationGroupedOutput;
	for (const k of PRACTICE_BUCKET_KEYS) {
		for (const q of clone.questions_by_type[k]) {
			const t = Number(q.estimated_time_seconds);
			q.estimated_time_seconds = Number.isFinite(t) && t >= 1 ? Math.round(t) : 60;
		}
	}
	let sum = sumGroupedEstimatedSeconds(clone);
	if (sum <= 0) return clone;
	if (sum >= lo && sum <= hi) return clone;
	let guard = 0;
	while ((sum < lo || sum > hi) && guard < 12) {
		guard++;
		const factor = sum < lo ? lo / sum : hi / sum;
		for (const k of PRACTICE_BUCKET_KEYS) {
			for (const q of clone.questions_by_type[k]) {
				q.estimated_time_seconds = Math.max(1, Math.round(q.estimated_time_seconds * factor));
			}
		}
		sum = sumGroupedEstimatedSeconds(clone);
	}
	return clone;
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
			visual: q.visual ?? null,
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
			visual: q.visual ?? null,
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
			visual: q.visual ?? null,
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
			visual: q.visual ?? null,
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

/** Maps flattened question order (round-robin across buckets) to bucket + slot for repairs. */
export type PracticeRoundRobinFlatIndexMapEntry = {
	flattenedIndex: number;
	bucket: PracticeGenerationBucketKey;
	/** 0-based index within `questions_by_type[bucket]` */
	slotInBucket: number;
};

/**
 * Same round-robin interleaving as {@link flattenPracticeGenerationOutput}: for each
 * round, take one question from each non-empty bucket in MCQ → fill → short → long order.
 */
export function buildPracticeRoundRobinFlatIndexMap(
	bucketLengths: Record<PracticeGenerationBucketKey, number>,
): PracticeRoundRobinFlatIndexMapEntry[] {
	const remaining: Record<PracticeGenerationBucketKey, number> = { ...bucketLengths };
	const out: PracticeRoundRobinFlatIndexMapEntry[] = [];
	let flat = 0;
	while (PRACTICE_BUCKET_KEYS.some((k) => (remaining[k] ?? 0) > 0)) {
		for (const key of PRACTICE_BUCKET_KEYS) {
			const left = remaining[key] ?? 0;
			if (left <= 0) continue;
			const slotInBucket = bucketLengths[key] - left;
			out.push({
				flattenedIndex: flat++,
				bucket: key,
				slotInBucket,
			});
			remaining[key] = left - 1;
		}
	}
	return out;
}

/** Structured context for VALIDATION repairs (mirrors {@link validateAndStripGeneration}). */
export type PracticeValidationRepairDiagnostics = {
	failureCode: string;
	expected: {
		totalQuestions: number;
		timeLimitSeconds: number | null;
		timeSumMin: number | null;
		timeSumMax: number | null;
		requiredTypeCounts: PracticeQuestionTypeCounts | null;
		allowedTopicIdsSample: readonly string[];
	};
	groupedBucketLengths: Record<PracticeGenerationBucketKey, number>;
	observed: {
		questionCount: number;
		estimatedTimeSum: number;
		typeCounts: Record<PracticeGenerationBucketKey, number>;
	};
	/** Point the model at exact bucket slots or flattened indices */
	targets: Array<{
		flattenedIndex: number | null;
		bucket: PracticeGenerationBucketKey | null;
		slotInBucket: number | null;
		question_number?: number;
		topic_id?: string;
		issue: string;
		hint: string;
	}>;
	globalHint: string;
};

/**
 * Builds machine-readable diagnostics for repair after {@link validateAndStripGeneration} fails.
 * Call with the same `flattened` / params that produced the validator message.
 */
export function buildPracticeValidationRepairDiagnostics(
	flattened: PracticeGenerationOutput,
	groupedBucketLengths: Record<PracticeGenerationBucketKey, number>,
	flatIndexMap: PracticeRoundRobinFlatIndexMapEntry[],
	params: {
		expectedQuestionCount: number;
		allowedTopicIds: Set<string>;
		expectedDurationSeconds?: number | null;
		expectedTypeCounts?: PracticeQuestionTypeCounts | null;
	},
	validatorMessage: string,
): PracticeValidationRepairDiagnostics {
	const flatLookup = new Map<number, PracticeRoundRobinFlatIndexMapEntry>();
	for (const e of flatIndexMap) {
		flatLookup.set(e.flattenedIndex, e);
	}

	const topicIdsSample = [...params.allowedTopicIds].slice(0, 24);
	const timeLo =
		params.expectedDurationSeconds != null && params.expectedDurationSeconds > 0 ?
			params.expectedDurationSeconds * 0.6
		:	null;
	const timeHi =
		params.expectedDurationSeconds != null && params.expectedDurationSeconds > 0 ?
			params.expectedDurationSeconds * 1.2
		:	null;

	const baseExpected = (): PracticeValidationRepairDiagnostics["expected"] => ({
		totalQuestions: params.expectedQuestionCount,
		timeLimitSeconds: params.expectedDurationSeconds ?? null,
		timeSumMin: timeLo,
		timeSumMax: timeHi,
		requiredTypeCounts: params.expectedTypeCounts ?? null,
		allowedTopicIdsSample: topicIdsSample,
	});

	const countMismatch = (): PracticeValidationRepairDiagnostics => ({
		failureCode: "question_count_mismatch",
		expected: baseExpected(),
		groupedBucketLengths,
		observed: {
			questionCount: flattened.questions.length,
			estimatedTimeSum: 0,
			typeCounts: {
				multiple_choice: 0,
				fill_in_blank: 0,
				short_answer: 0,
				long_answer: 0,
			},
		},
		targets: [],
		globalHint: `Grouped buckets sum to ${Object.values(groupedBucketLengths).reduce((a, b) => a + b, 0)} items; flattened list length is ${flattened.questions.length}. Each questions_by_type array length must equal REQUIRED_BUCKET_LENGTHS.`,
	});

	if (flattened.questions.length !== params.expectedQuestionCount) {
		return countMismatch();
	}

	const canonicalTopicIdByNormalized = new Map<string, string>();
	for (const id of params.allowedTopicIds) {
		canonicalTopicIdByNormalized.set(normalizePracticeTopicId(id), id);
	}
	const allowedNormalized = new Set(canonicalTopicIdByNormalized.keys());

	const seenNumbers = new Map<number, number>();
	const typeCounts: Record<PracticeGenerationBucketKey, number> = {
		multiple_choice: 0,
		fill_in_blank: 0,
		short_answer: 0,
		long_answer: 0,
	};
	let totalTime = 0;

	for (let i = 0; i < flattened.questions.length; i++) {
		const q = flattened.questions[i]!;
		const loc = flatLookup.get(i);
		const tloc = (): PracticeValidationRepairDiagnostics["targets"][0] => ({
			flattenedIndex: i,
			bucket: loc?.bucket ?? null,
			slotInBucket: loc?.slotInBucket ?? null,
			question_number: q.question_number,
			topic_id: q.topic_id,
			issue: "",
			hint: "",
		});

		if (seenNumbers.has(q.question_number)) {
			const prevIdx = seenNumbers.get(q.question_number)!;
			return {
				failureCode: "duplicate_question_number",
				expected: baseExpected(),
				groupedBucketLengths,
				observed: {
					questionCount: flattened.questions.length,
					estimatedTimeSum: totalTime,
					typeCounts,
				},
				targets: [
					{
						...tloc(),
						issue: `Duplicate question_number ${q.question_number}`,
						hint: `Also appears at flattenedIndex ${prevIdx}. Renumber sequentially 1…N in round-robin order or fix duplicates.`,
					},
					{
						flattenedIndex: prevIdx,
						bucket: flatLookup.get(prevIdx)?.bucket ?? null,
						slotInBucket: flatLookup.get(prevIdx)?.slotInBucket ?? null,
						question_number: q.question_number,
						topic_id: flattened.questions[prevIdx]?.topic_id,
						issue: `Duplicate question_number ${q.question_number}`,
						hint: "Keep exactly one occurrence per question_number.",
					},
				],
				globalHint: "question_number values must be unique across the flattened test.",
			};
		}
		seenNumbers.set(q.question_number, i);

		const topicKey = normalizePracticeTopicId(q.topic_id);
		if (!allowedNormalized.has(topicKey)) {
			const hint =
				params.allowedTopicIds.size <= 48 ?
					`Copy topic_id verbatim from ALLOWED_TOPIC_IDS (${[...params.allowedTopicIds].join(", ")}).`
				:	"Copy topic_id verbatim from ALLOWED_TOPIC_IDS (see JSON list in user prompt).";

			return {
				failureCode: "disallowed_topic_id",
				expected: baseExpected(),
				groupedBucketLengths,
				observed: {
					questionCount: flattened.questions.length,
					estimatedTimeSum: totalTime,
					typeCounts,
				},
				targets: [{ ...tloc(), issue: `topic_id ${q.topic_id} is not allowed`, hint }],
				globalHint:
					"Each topic_id must be an exact UUID from the student's topic selection (case-normalized match).",
			};
		}

		if (q.question_type === "multiple_choice") {
			const optionMap = mcqOptionMap(q.options);
			if (!optionMap) {
				const keys = q.options ? Object.keys(q.options) : [];
				return {
					failureCode: "mcq_missing_options",
					expected: baseExpected(),
					groupedBucketLengths,
					observed: {
						questionCount: flattened.questions.length,
						estimatedTimeSum: totalTime,
						typeCounts,
					},
					targets: [
						{
							...tloc(),
							issue: "MCQ missing valid A,B,C,D option keys",
							hint:
								`Present keys: ${JSON.stringify(keys)}. Add/adjust options so keys A,B,C,D exist with non-empty strings.`,
						},
					],
					globalHint:
						"multiple_choice rows require options object with exactly A,B,C,D (uppercase keys after trim).",
				};
			}
			const check = validateMcqAnswerKey(q.answer_key.correct_answer, optionMap);
			if (!check.ok) {
				return {
					failureCode: "mcq_bad_answer_key",
					expected: baseExpected(),
					groupedBucketLengths,
					observed: {
						questionCount: flattened.questions.length,
						estimatedTimeSum: totalTime,
						typeCounts,
					},
					targets: [
						{
							...tloc(),
							issue: `correct_answer "${q.answer_key.correct_answer}"`,
							hint:
								"Set correct_answer to exactly one letter A, B, C, or D that exists as an option key.",
						},
					],
					globalHint:
						"MCQ answer_key.correct_answer must be a single letter A–D matching an option key.",
				};
			}
		} else if (q.options != null && Object.keys(q.options).length > 0) {
			return {
				failureCode: "non_mcq_has_options",
				expected: baseExpected(),
				groupedBucketLengths,
				observed: {
					questionCount: flattened.questions.length,
					estimatedTimeSum: totalTime,
					typeCounts,
				},
				targets: [
					{
						...tloc(),
						issue: `Question type ${q.question_type} has options object`,
						hint: "Set options to null for non-multiple-choice items.",
					},
				],
				globalHint: "Only multiple_choice rows may carry options.",
			};
		}

		typeCounts[q.question_type]++;
		totalTime += q.estimated_time_seconds;
	}

	const distinctTypes = (Object.values(typeCounts) as number[]).filter((n) => n > 0).length;
	const typesRequiredByPlan =
		params.expectedTypeCounts != null ?
			PRACTICE_BUCKET_KEYS.filter((k) => (params.expectedTypeCounts![k] ?? 0) > 0).length
		:	null;

	if (typesRequiredByPlan == null) {
		if (distinctTypes < 2) {
			return {
				failureCode: "type_variety",
				expected: baseExpected(),
				groupedBucketLengths,
				observed: {
					questionCount: flattened.questions.length,
					estimatedTimeSum: totalTime,
					typeCounts,
				},
				targets: [],
				globalHint: `Only ${distinctTypes} distinct question_type(s) present; need ≥2.`,
			};
		}
	} else if (typesRequiredByPlan >= 2 && distinctTypes < 2) {
		return {
			failureCode: "type_variety",
			expected: baseExpected(),
			groupedBucketLengths,
			observed: {
				questionCount: flattened.questions.length,
				estimatedTimeSum: totalTime,
				typeCounts,
			},
			targets: [],
			globalHint: "Plan requires multiple types but output collapsed to fewer types.",
		};
	}

	if (params.expectedTypeCounts) {
		const t = params.expectedTypeCounts;
		for (const key of PRACTICE_BUCKET_KEYS) {
			const got = typeCounts[key];
			const want = t[key];
			if (got !== want) {
				return {
					failureCode: "type_mix_mismatch",
					expected: baseExpected(),
					groupedBucketLengths,
					observed: {
						questionCount: flattened.questions.length,
						estimatedTimeSum: totalTime,
						typeCounts,
					},
					targets: [],
					globalHint: `Per-type counts after flatten: ${JSON.stringify(typeCounts)}. Required ${JSON.stringify(t)} — move/regenerate rows across questions_by_type buckets so each array length matches REQUIRED_BUCKET_LENGTHS.`,
				};
			}
		}
	}

	if (
		params.expectedDurationSeconds != null &&
		params.expectedDurationSeconds > 0 &&
		totalTime > 0 &&
		timeLo != null &&
		timeHi != null &&
		(totalTime < timeLo || totalTime > timeHi)
	) {
		return {
			failureCode: "time_budget",
			expected: baseExpected(),
			groupedBucketLengths,
			observed: {
				questionCount: flattened.questions.length,
				estimatedTimeSum: totalTime,
				typeCounts,
			},
			targets: [],
			globalHint: `Sum of estimated_time_seconds is ${totalTime}s; must be in [${Math.round(timeLo)}, ${Math.round(timeHi)}]. Scale times proportionally or adjust a few questions only.`,
		};
	}

	// Should not happen if validatorMessage already failed
	return {
		failureCode: "unknown_validation",
		expected: baseExpected(),
		groupedBucketLengths,
		observed: {
			questionCount: flattened.questions.length,
			estimatedTimeSum: totalTime,
			typeCounts,
		},
		targets: [],
		globalHint: validatorMessage,
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

	const distinctTypes = (Object.values(typeCounts) as number[]).filter((n) => n > 0).length;
	const typesRequiredByPlan =
		opts.expectedTypeCounts != null ?
			PRACTICE_TYPE_KEYS.filter((k) => (opts.expectedTypeCounts![k] ?? 0) > 0).length
		:	null;
	// Variety rule: mixed-type plans must produce ≥2 types. Single-type plans
	// (e.g. Mathematics → all MCQ) must not be rejected here.
	if (typesRequiredByPlan == null) {
		if (distinctTypes < 2) {
			return {
				ok: false,
				message: "The test must include at least two question types. Try generating again.",
			};
		}
	} else if (typesRequiredByPlan >= 2 && distinctTypes < 2) {
		return {
			ok: false,
			message: "The test must include at least two question types. Try generating again.",
		};
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
		visual: q.visual ?? null,
	}));

	const generation_metadata: PublicGenerationMetadata = {
		topic_distribution: Object.fromEntries(topicCounts),
		difficulty_distribution: difficultyCounts,
		type_distribution: typeCounts,
		adaptation_rationale: raw.generation_metadata?.adaptation_rationale ?? "",
	};

	return { ok: true, questions, generation_metadata };
}
