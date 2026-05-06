import { getPracticeQuestionPlanForSubject } from "./constants";
import type { PracticeFocusArea } from "./schemas";
import type { PracticeCanonicalTopic, PracticeDifficulty } from "./types";

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

const GENERATION_DIRECTIVE_INSTRUCTION =
	"Generate original practice questions aligned to the supplied curriculum and exercise-style references in topic_grounding; do not copy exercise chunk wording verbatim.";

export type PracticeUserMessagePayload = {
	schema_version: 3;
	intent: "generate_practice_test";
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
		note: string;
		/** Instruction for the model; replaces the old parallel `generation_directives` block. */
		generation_instruction: string;
		/** Derived from `grounding_meta.context_quality`; tells the model when to stay conservative. */
		context_quality_instruction: string;
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

	const focusArea = input.focusArea ?? "all";
	const focusAreaInstruction = FOCUS_AREA_INSTRUCTION[focusArea];

	return {
		schema_version: 3,
		intent: "generate_practice_test",
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
			note: "Question count and per-type counts are fixed by duration. Fill the required questions_by_type buckets exactly before any final ordering.",
			generation_instruction: GENERATION_DIRECTIVE_INSTRUCTION,
			context_quality_instruction: contextQualityInstruction,
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
			pedagogy:
				"Align to NCERT-style outcomes for the given grade. Apply Bloom-style cognitive progression and obey test_parameters.coverage_mode and coverage_instruction. Fill each questions_by_type bucket with exactly the requested number of questions before any final ordering. For fill_in_blank: one word or a very short phrase; no options. For short_answer: brief sentences. For long_answer: multi-sentence or short paragraph. Prefer clarity over trick questions; avoid ambiguous wording. When student.recent_errors is present, bias items toward those concepts where pedagogically appropriate. Use topic_grounding for curriculum and exercise-style context; per-topic performance is under topics keyed by topic_id.",
		},
	};
}

export function toPracticeUserMessageForModel(payload: PracticeUserMessagePayload): PracticeUserMessageForModel {
	const { grounding_meta, ...rest } = payload;
	const { fetch_error: _fetchError, ...metaForModel } = grounding_meta;
	void _fetchError;
	return { ...rest, grounding_meta: metaForModel };
}

export function stringifyPracticeUserMessage(payload: PracticeUserMessagePayload | PracticeUserMessageForModel): string {
	return `${JSON.stringify(payload, null, 2)}\n`;
}

export function stringifyPracticeUserMessageForModel(payload: PracticeUserMessagePayload): string {
	return stringifyPracticeUserMessage(toPracticeUserMessageForModel(payload));
}
