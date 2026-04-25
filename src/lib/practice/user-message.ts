import { getPracticeQuestionPlan } from "./constants";
import type { PracticeCanonicalTopic, PracticeDifficulty } from "./types";

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
	};
}

export function buildPracticeUserMessage(input: {
	studentGrade: number | null;
	subject: { id: string; name: string };
	difficulty: PracticeDifficulty;
	timeLimitSeconds: number;
	recentErrors?: PracticeRecentError[];
	topics: PracticeCanonicalTopic[];
	/** When omitted, topic_grounding uses empty chunk arrays (e.g. unit tests). Server paths should pass DB-backed context. */
	preFetchedTopicContext?: PreFetchedTopicContext;
}): PracticeUserMessagePayload {
	const plan = getPracticeQuestionPlan(input.timeLimitSeconds);
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

	return {
		schema_version: 3,
		intent: "generate_practice_test",
		student: {
			grade: input.studentGrade,
			recent_errors: input.recentErrors && input.recentErrors.length > 0 ? input.recentErrors : undefined,
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
