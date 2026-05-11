import { getPracticeQuestionPlanForSubject, isMathematicsSubject } from "./constants";
import type { PracticeFocusArea } from "./schemas";
import type { PracticeCanonicalTopic, PracticeDifficulty } from "./types";
import { isPracticeVisualsEnabled, isPracticeVisualsEnabledForSubject } from "./visuals/env";
import type { QuestionVisualKind } from "./visuals/types";

const FOCUS_AREA_INSTRUCTION: Record<PracticeFocusArea, string> = {
	all: "Cover all selected topics evenly. No directional bias from focus_area.",
	weak: "The student picked 'weak topics only' — every selected topic is a weakness. Pitch questions slightly above the student's current ability so the test exercises improvement without becoming demoralizing. Prefer items that surface common misconceptions over rote recall.",
	not_tested: "The student picked 'not tested yet' — these topics have no prior performance data. Use the curriculum chunks heavily, start at the lower end of the requested difficulty, and emphasize foundational concept checks before higher-order items.",
	recent_errors: "The student picked 'recent mistakes' — bias question selection toward concepts in student.recent_errors when present. Vary the framing from the original misses (different scenario, different numbers) so the student is testing the concept, not memorizing the question.",
};

export type PracticeCoverageMode = "few_topics" | "balanced" | "many_topics";

function coverageModeAndInstruction(
	topicCount: number,
	questionCount: number,
): { coverage_mode: PracticeCoverageMode; coverage_instruction: string } {
	if (topicCount < questionCount) {
		return {
			coverage_mode: "few_topics",
			coverage_instruction:
				"Fewer topics than questions: reuse topic_ids across multiple items. Within each topic, increase cognitive demand and item difficulty across questions (Bloom-style progression); avoid repeating the same difficulty level without escalation.",
		};
	}
	if (topicCount > questionCount) {
		return {
			coverage_mode: "many_topics",
			coverage_instruction:
				"More topics than questions: prioritize weaker or higher-impact topics using performance data (e.g. lower average_score_percent, bad or not_tested status, fewer tests_taken, declining trend). Some selected topics may receive zero questions; summarize prioritization in generation_metadata.adaptation_rationale.",
		};
	}
	return {
		coverage_mode: "balanced",
		coverage_instruction:
			"Topic count aligns with question count: distribute questions across topics fairly while weighting weaker performance when data exists.",
	};
}

export type PracticeRecentError = {
	topic_id: string;
	topic_name: string;
	concept: string;
	verdict: "partially_correct" | "incorrect";
	last_seen_at: string | null;
};

export type PracticeTopicChunkLine = { text: string; source_ref: string | null };

export type PracticeGroundingMeta = {
	topic_count: number;
	context_chunk_count: number;
	exercise_chunk_count: number;
	context_char_total: number;
	exercise_char_total: number;
	truncated: boolean;
	fetch_error?: string;
	/**
	 * `low_context` is set when fewer than half of the selected topics had
	 * any context chunks at all — the model should fall back to curriculum
	 * outcomes and avoid claiming specific examples it can't verify.
	 * `no_context` is the all-empty case: model is told to flag uncertainty.
	 */
	context_quality?: "ok" | "low_context" | "no_context";
};

/** `grounding_meta` as sent to the model: no operational `fetch_error`. */
export type PracticeGroundingMetaForModel = Omit<PracticeGroundingMeta, "fetch_error">;

export type PreFetchedTopicContext = {
	byTopic: Map<string, { context: PracticeTopicChunkLine[]; exercise: PracticeTopicChunkLine[] }>;
	meta: PracticeGroundingMeta;
};

export type PracticeTopicGrounding = {
	topic_id: string;
	topic_name: string;
	curriculum_hint: { unit_name: string; chapter_name: string; grade: number };
	content_chunks: PracticeTopicChunkLine[];
	exercise_chunks: PracticeTopicChunkLine[];
};

/**
 * Compact "anchor" header serialized FIRST in the JSON payload. Models reliably
 * latch onto the first clear summary in a long input; mirroring the hard-gate
 * facts here halves the cognitive cost of locating counts, time band, and the
 * topic-id allowlist while the model is composing items.
 */
export type PracticeGenerationSummary = {
	total: number;
	counts: {
		multiple_choice: number;
		fill_in_blank: number;
		short_answer: number;
		long_answer: number;
	};
	duration_seconds: number;
	time_sum_min: number;
	time_sum_max: number;
	allowed_topic_ids: string[];
	coverage_mode: PracticeCoverageMode;
	difficulty: PracticeDifficulty;
	subject_is_math: boolean;
};

export type PracticeUserMessagePayload = {
	schema_version: 3;
	intent: "generate_practice_test";
	/** Anchor header — see {@link PracticeGenerationSummary}. */
	generation_summary: PracticeGenerationSummary;
	student: {
		grade: number | null;
		/**
		 * Phase 3: up to 8 recent missed concepts across the chosen subject,
		 * used to bias question generation toward spaced repetition.
		 */
		recent_errors?: PracticeRecentError[];
		/**
		 * The "Quick pick" the student chose on the topics step. Forwarded so
		 * the model can weight question selection — e.g. "recent_errors" leans
		 * harder on `recent_errors`, "not_tested" leans on `topic_grounding`
		 * for items the student has never seen.
		 */
		focus_area?: PracticeFocusArea;
		focus_area_instruction?: string;
	};
	subject: {
		id: string;
		name: string;
	};
	/** Per-topic NCERT-style chunks from `topic_context_chunks` (server-filled). */
	topic_grounding: PracticeTopicGrounding[];
	grounding_meta: PracticeGroundingMeta;
	test_parameters: {
		difficulty: PracticeDifficulty;
		time_limit_seconds: number;
		estimated_question_count: number;
		topic_count: number;
		coverage_mode: PracticeCoverageMode;
		coverage_instruction: string;
		question_type_counts: {
			multiple_choice: number;
			fill_in_blank: number;
			short_answer: number;
			long_answer: number;
		};
		/** Derived from `grounding_meta.context_quality`; tells the model when to stay conservative. */
		context_quality_instruction: string;
		/** Exact UUID allowlist for topic_id on every question (same as topics[].topic_id). */
		allowed_topic_ids: string[];
		/**
		 * Visuals policy. `enabled` mirrors the PRACTICE_VISUALS env flag;
		 * when false the model is told elsewhere (system prompt) to emit
		 * `visual: null` on every question. `preferred_kinds` advertises the
		 * subset of visual kinds whose renderers are wired for this subject.
		 */
		visuals_policy: {
			enabled: boolean;
			preferred_kinds: QuestionVisualKind[];
			/**
			 * Upper bound aligned with test size when visuals apply (`estimated_question_count`);
			 * there is no fractional quota — every item may use a non-null `visual` if T1/T2/T3 warrants it.
			 * Zero means non-null visuals are disallowed for this generation.
			 */
			max_non_null_visuals: number;
		};
		/**
		 * When chunks exist, `prefer_chunk_aligned_items` is true so the model
		 * prioritises stems traceable to `topic_grounding` (see system prompt).
		 */
		grounding_policy: {
			mode: "chunk_aligned" | "curriculum_hint_only";
			prefer_chunk_aligned_items: boolean;
		};
	};
	/** Per-topic performance only; curriculum names live under `topic_grounding`. */
	topics: Array<{
		topic_id: string;
		performance: {
			status: string;
			average_score_percent: number | null;
			tests_taken: number;
			trend: string;
			last_test_date: string | null;
		};
	}>;
	constraints: {
		question_types: readonly [
			"multiple_choice",
			"fill_in_blank",
			"short_answer",
			"long_answer",
		];
		pedagogy: string;
	};
};

export type PracticeUserMessageForModel = Omit<PracticeUserMessagePayload, "grounding_meta"> & {
	grounding_meta: PracticeGroundingMetaForModel;
};

function defaultGroundingMeta(topicCount: number): PracticeGroundingMeta {
	return {
		topic_count: topicCount,
		context_chunk_count: 0,
		exercise_chunk_count: 0,
		context_char_total: 0,
		exercise_char_total: 0,
		truncated: false,
		context_quality: topicCount === 0 ? "ok" : "no_context",
	};
}

const CONTEXT_QUALITY_INSTRUCTION: Record<NonNullable<PracticeGroundingMeta["context_quality"]>, string> = {
	ok: "Curriculum context is available for the selected topics. Ground items in `topic_grounding.content_chunks` and `topic_grounding.exercise_chunks` where it materially helps.",
	low_context: "Several selected topics have empty `content_chunks` and `exercise_chunks`. For those topics, stick to NCERT-style outcomes implied by `curriculum_hint` and AVOID inventing specific named examples, dates, or formulae you cannot verify.",
	no_context: "ALL selected topics have empty grounding chunks. You are working from `curriculum_hint` only — keep questions at conceptual / definition level and AVOID specific case studies, named experiments, or numeric data that depend on a textbook source. If a question can't be written safely, prefer a simpler conceptual variant.",
};

/**
 * Per-subject allowed visual kinds. The model receives this list verbatim
 * inside the user message; the system prompt's discipline section is the
 * source of truth on WHEN to emit. Subjects without a renderer-supported
 * visual route ship an empty array — the prompt then keeps them on
 * visual: null.
 */
function preferredVisualKindsForSubject(subjectName: string | null | undefined): QuestionVisualKind[] {
	if (!subjectName) return [];
	const lower = subjectName.toLowerCase();
	if (lower.includes("mathematics") || lower.includes("math")) {
		return ["math_geometry", "math_function_plot", "number_line", "data_table"];
	}
	if (lower.includes("physics")) {
		return ["physics_diagram", "math_function_plot", "data_table"];
	}
	if (lower.includes("chemistry")) {
		return ["chemistry_molecule", "chemistry_reaction"];
	}
	if (lower.includes("accountancy") || lower.includes("financial accounting")) {
		return ["accountancy_table"];
	}
	if (lower.includes("business studies")) {
		return ["statistics_chart", "data_table", "economics_curve", "math_function_plot"];
	}
	if (lower.includes("economics") || lower.includes("statistics")) {
		return [
			"economics_curve",
			"statistics_chart",
			"data_table",
			"math_function_plot",
		];
	}
	// Before plain "science": otherwise "social science" matches integrated Science visuals.
	if (
		lower.includes("geography") ||
		lower.includes("social science") ||
		lower.includes("political science") ||
		lower.includes("civics") ||
		lower.includes("history")
	) {
		return ["india_map", "statistics_chart", "data_table", "math_function_plot"];
	}
	if (lower.includes("science")) {
		return [
			"physics_diagram",
			"chemistry_molecule",
			"chemistry_reaction",
			"data_table",
			"statistics_chart",
		];
	}
	if (lower.includes("english")) {
		return ["english_passage"];
	}
	if (lower.includes("biology")) {
		// No dedicated tissue / organ diagram renderer; tables & charts cover many data-heavy items.
		return ["data_table", "statistics_chart"];
	}
	// Unknown subject names: keep empty until explicitly routed (avoid invented kinds).
	return [];
}

export function buildPracticeUserMessage(input: {
	studentGrade: number | null;
	subject: { id: string; name: string };
	difficulty: PracticeDifficulty;
	timeLimitSeconds: number;
	recentErrors?: PracticeRecentError[];
	topics: PracticeCanonicalTopic[];
	/** Quick-pick filter the student chose on the topics step. */
	focusArea?: PracticeFocusArea;
	/** When omitted, topic_grounding uses empty chunk arrays (e.g. unit tests). Server paths should pass DB-backed context. */
	preFetchedTopicContext?: PreFetchedTopicContext;
}): PracticeUserMessagePayload {
	const plan = getPracticeQuestionPlanForSubject(input.timeLimitSeconds, input.subject.name);
	const estimated_question_count = plan.total;
	const question_type_counts = plan.counts;
	const topic_count = input.topics.length;
	const { coverage_mode, coverage_instruction } = coverageModeAndInstruction(
		topic_count,
		estimated_question_count,
	);
	const pre = input.preFetchedTopicContext;

	const topic_grounding: PracticeTopicGrounding[] = input.topics.map((t) => {
		const pack = pre?.byTopic.get(t.topicId) ?? { context: [], exercise: [] };
		return {
			topic_id: t.topicId,
			topic_name: t.topicName,
			curriculum_hint: {
				unit_name: t.unitName,
				chapter_name: t.chapterName,
				grade: t.grade,
			},
			content_chunks: pack.context,
			exercise_chunks: pack.exercise,
		};
	});

	const grounding_meta = pre?.meta ?? defaultGroundingMeta(topic_count);
	const contextQualityKey = grounding_meta.context_quality ?? "ok";
	const contextQualityInstruction = CONTEXT_QUALITY_INSTRUCTION[contextQualityKey];
	const hasTopicChunks =
		(grounding_meta.context_chunk_count ?? 0) + (grounding_meta.exercise_chunk_count ?? 0) > 0;

	const focusArea = input.focusArea ?? "all";
	const focusAreaInstruction = FOCUS_AREA_INSTRUCTION[focusArea];

	const allowed_topic_ids = input.topics.map((t) => t.topicId);
	const subject_is_math = isMathematicsSubject(input.subject.name);
	const visualsMasterOn = isPracticeVisualsEnabled();
	const visualsEffective = isPracticeVisualsEnabledForSubject(input.subject.name);
	const preferredKinds =
		visualsMasterOn ?
			visualsEffective ?
				preferredVisualKindsForSubject(input.subject.name)
			:	[]
		:	preferredVisualKindsForSubject(input.subject.name);

	/** Mirrors question count when visuals apply so payloads stay backward-compatible; no fractional cap. */
	const maxNonNullVisuals =
		visualsEffective && preferredKinds.length > 0 ? estimated_question_count : 0;

	const generation_summary: PracticeGenerationSummary = {
		total: estimated_question_count,
		counts: question_type_counts,
		duration_seconds: input.timeLimitSeconds,
		time_sum_min: Math.round(input.timeLimitSeconds * 0.6),
		time_sum_max: Math.round(input.timeLimitSeconds * 1.2),
		allowed_topic_ids,
		coverage_mode,
		difficulty: input.difficulty,
		subject_is_math,
	};

	return {
		schema_version: 3,
		intent: "generate_practice_test",
		// Anchor header at the top so the model latches onto counts/time band
		// before parsing the rest of the payload. Duplicates a few fields
		// from `test_parameters` on purpose; signal density beats DRY here.
		generation_summary,
		student: {
			grade: input.studentGrade,
			recent_errors: input.recentErrors && input.recentErrors.length > 0 ? input.recentErrors : undefined,
			focus_area: focusArea,
			focus_area_instruction: focusAreaInstruction,
		},
		subject: {
			id: input.subject.id,
			name: input.subject.name,
		},
		topic_grounding,
		grounding_meta,
		test_parameters: {
			difficulty: input.difficulty,
			time_limit_seconds: input.timeLimitSeconds,
			estimated_question_count,
			topic_count,
			coverage_mode,
			coverage_instruction,
			question_type_counts,
			context_quality_instruction: contextQualityInstruction,
			allowed_topic_ids,
			visuals_policy: {
				enabled: visualsEffective,
				preferred_kinds: preferredKinds,
				max_non_null_visuals: maxNonNullVisuals,
			},
			grounding_policy: {
				mode: hasTopicChunks ? "chunk_aligned" : "curriculum_hint_only",
				prefer_chunk_aligned_items: hasTopicChunks,
			},
		},
		topics: input.topics.map((t) => ({
			topic_id: t.topicId,
			performance: {
				status: t.status,
				average_score_percent: t.averageScore,
				tests_taken: t.testsTaken,
				trend: t.trend,
				last_test_date: t.lastTestDate,
			},
		})),
		constraints: {
			question_types: ["multiple_choice", "fill_in_blank", "short_answer", "long_answer"],
			// Trimmed in v3.2.1: the system prompt now owns pedagogy. Keep
			// only a one-line orientation here so the JSON payload still
			// flags the constraint surface for the model.
			pedagogy:
				"Follow the system prompt's HARD GATES and final compliance checklist; obey test_parameters.coverage_mode and coverage_instruction; bias toward student.recent_errors where pedagogically appropriate.",
		},
	};
}

export function toPracticeUserMessageForModel(payload: PracticeUserMessagePayload): PracticeUserMessageForModel {
	const { grounding_meta, ...rest } = payload;
	const { fetch_error: _fetchError, ...metaForModel } = grounding_meta;
	void _fetchError;
	return { ...rest, grounding_meta: metaForModel };
}

/**
 * Strip empty arrays inside `topic_grounding[].content_chunks`/`exercise_chunks`
 * and any per-topic null fields before sending to the model. This keeps the
 * server-stored payload identical (DB still gets the full shape via
 * `stringifyPracticeUserMessage`) but trims tokens on the model-bound copy.
 *
 * Returns a deep clone — callers may mutate freely.
 */
export function compactPayloadForModel(payload: PracticeUserMessageForModel): PracticeUserMessageForModel {
	const clone = structuredClone(payload) as PracticeUserMessageForModel;
	clone.topic_grounding = clone.topic_grounding.map((topic) => {
		const out: Record<string, unknown> = {
			topic_id: topic.topic_id,
			topic_name: topic.topic_name,
			curriculum_hint: topic.curriculum_hint,
		};
		if (topic.content_chunks.length > 0) out.content_chunks = topic.content_chunks;
		if (topic.exercise_chunks.length > 0) out.exercise_chunks = topic.exercise_chunks;
		return out as PracticeTopicGrounding;
	});
	clone.topics = clone.topics.map((t) => {
		const perf: Record<string, unknown> = { status: t.performance.status };
		if (t.performance.average_score_percent != null) {
			perf.average_score_percent = t.performance.average_score_percent;
		}
		if (t.performance.tests_taken !== 0) perf.tests_taken = t.performance.tests_taken;
		if (t.performance.trend && t.performance.trend !== "unknown") {
			perf.trend = t.performance.trend;
		}
		if (t.performance.last_test_date != null) perf.last_test_date = t.performance.last_test_date;
		return { topic_id: t.topic_id, performance: perf as typeof t.performance };
	});
	if (clone.student.recent_errors && clone.student.recent_errors.length === 0) {
		delete clone.student.recent_errors;
	}
	return clone;
}

/**
 * Pretty-printed serialization. Used for storage / logs / unit tests.
 * Do NOT call this for the model-bound prompt — use
 * {@link stringifyPracticeUserMessageForModel} instead, which is compact
 * (no indent) and applies {@link compactPayloadForModel}.
 */
export function stringifyPracticeUserMessage(payload: PracticeUserMessagePayload | PracticeUserMessageForModel): string {
	return `${JSON.stringify(payload, null, 2)}\n`;
}

/**
 * Compact serialization for the model: no whitespace, empty arrays / null
 * performance fields stripped. The model parses JSON, not pretty-printed
 * JSON, so we save tokens with zero loss of meaning.
 */
export function stringifyPracticeUserMessageForModel(payload: PracticeUserMessagePayload): string {
	const forModel = toPracticeUserMessageForModel(payload);
	const compact = compactPayloadForModel(forModel);
	return JSON.stringify(compact);
}
