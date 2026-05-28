import type { SupabaseClient } from "@supabase/supabase-js";

import { logServerError } from "@/lib/server/log-supabase-error";

import { tagTopicContextFetchFailed } from "./sentry-tags";
import type { PracticeGroundingMeta, PracticeTopicChunkLine, PreFetchedTopicContext } from "./user-message";

type TopicChunkBuckets = {
	context: PracticeTopicChunkLine[];
	exercise: PracticeTopicChunkLine[];
	questionBank: PracticeTopicChunkLine[];
};

function charSum(lines: PracticeTopicChunkLine[]): number {
	return lines.reduce((a, c) => a + c.text.length, 0);
}

function shuffleCopy<T>(arr: T[], random: () => number): T[] {
	const out = [...arr];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j]!, out[i]!];
	}
	return out;
}

export type RawTopicChunkRow = {
	topic_id: string;
	content: string;
	chunk_type: string;
	source_ref: string | null;
	created_at: string;
};

/**
 * Deterministic order: canonical `topicOrder`, then `created_at` ascending, then `content` for stability.
 * Use after PostgREST fetch so chunk order does not depend on multiple `.order()` support.
 */
export function sortRawChunksByTopicThenCreated(
	rows: RawTopicChunkRow[],
	topicOrder: string[],
): RawTopicChunkRow[] {
	const orderIndex = new Map(topicOrder.map((id, i) => [id, i]));
	return [...rows].sort((a, b) => {
		const ai = orderIndex.get(a.topic_id) ?? 99_999;
		const bi = orderIndex.get(b.topic_id) ?? 99_999;
		if (ai !== bi) return ai - bi;
		const ta = new Date(a.created_at).getTime();
		const tb = new Date(b.created_at).getTime();
		if (ta !== tb) return ta - tb;
		return a.content.localeCompare(b.content);
	});
}

/**
 * Shuffles exercise / question-bank chunks per topic (context stays in created_at order).
 * All fetched chunks are included — no per-topic or global char/chunk caps.
 * Exported for unit tests.
 */
export function applyTopicContextLimits(
	raw: Map<string, TopicChunkBuckets>,
	topicOrder: string[],
	_options: { random?: () => number } = {},
): { byTopic: Map<string, TopicChunkBuckets>; truncated: boolean } {
	const byTopic = new Map<string, TopicChunkBuckets>();
	const random = _options.random ?? Math.random;

	for (const tid of topicOrder) {
		const b = raw.get(tid) ?? { context: [], exercise: [], questionBank: [] };
		byTopic.set(tid, {
			context: [...b.context],
			exercise: shuffleCopy(b.exercise, random),
			questionBank: shuffleCopy(b.questionBank, random),
		});
	}

	return { byTopic, truncated: false };
}

function buildMeta(
	byTopic: Map<string, TopicChunkBuckets>,
	topicOrder: string[],
	fetchError?: string,
): PracticeGroundingMeta {
	let contextChunkCount = 0;
	let exerciseChunkCount = 0;
	let questionBankChunkCount = 0;
	let contextCharTotal = 0;
	let exerciseCharTotal = 0;
	let questionBankCharTotal = 0;
	let topicsWithAnyChunk = 0;
	for (const tid of topicOrder) {
		const b = byTopic.get(tid);
		if (!b) continue;
		contextChunkCount += b.context.length;
		exerciseChunkCount += b.exercise.length;
		questionBankChunkCount += b.questionBank.length;
		contextCharTotal += charSum(b.context);
		exerciseCharTotal += charSum(b.exercise);
		questionBankCharTotal += charSum(b.questionBank);
		if (b.context.length > 0 || b.exercise.length > 0 || b.questionBank.length > 0) topicsWithAnyChunk++;
	}
	const totalTopics = topicOrder.length;
	const context_quality: PracticeGroundingMeta["context_quality"] =
		totalTopics === 0 ? "ok"
		: topicsWithAnyChunk === 0 ? "no_context"
		: topicsWithAnyChunk * 2 < totalTopics ? "low_context"
		: "ok";
	return {
		topic_count: totalTopics,
		context_chunk_count: contextChunkCount,
		exercise_chunk_count: exerciseChunkCount,
		question_bank_chunk_count: questionBankChunkCount,
		context_char_total: contextCharTotal,
		exercise_char_total: exerciseCharTotal,
		question_bank_char_total: questionBankCharTotal,
		truncated: false,
		context_quality,
		...(fetchError ? { fetch_error: fetchError } : {}),
	};
}

/**
 * Log aggregate stats only (no raw chunk text). Runs only when `PRACTICE_TOPIC_CONTEXT_LOG === "true"` (dev and prod).
 */
export function logPracticeTopicContextStats(meta: PracticeGroundingMeta, context: string = "practice.topic_context_grounding"): void {
	if (process.env.PRACTICE_TOPIC_CONTEXT_LOG !== "true") return;
	if (process.env.NODE_ENV === "development") {
		console.info(`[${context}]`, {
			topic_count: meta.topic_count,
			context_chunks: meta.context_chunk_count,
			exercise_chunks: meta.exercise_chunk_count,
			question_bank_chunks: meta.question_bank_chunk_count,
			context_chars: meta.context_char_total,
			exercise_chars: meta.exercise_char_total,
			question_bank_chars: meta.question_bank_char_total,
			truncated: meta.truncated,
			fetch_error: meta.fetch_error ?? null,
		});
		return;
	}
	console.info(
		`[${context}] topic_count=${meta.topic_count} context_chunks=${meta.context_chunk_count} exercise_chunks=${meta.exercise_chunk_count} question_bank_chunks=${meta.question_bank_chunk_count} context_chars=${meta.context_char_total} exercise_chars=${meta.exercise_char_total} question_bank_chars=${meta.question_bank_char_total} truncated=${meta.truncated}`,
	);
}

/**
 * Fetches `topic_context_chunks` for verified topic ids (server: after enrollment check).
 * Uses the admin client; RLS is bypassed. Rows are split by `chunk_type`, ordered by `created_at` ascending
 * (enforced in-process after fetch).
 */
export async function fetchTopicContextChunksByTopicIds(
	admin: SupabaseClient,
	topicIds: string[],
): Promise<PreFetchedTopicContext> {
	const topicOrder = [...topicIds];
	if (topicOrder.length === 0) {
		return {
			byTopic: new Map(),
			meta: {
				topic_count: 0,
				context_chunk_count: 0,
				exercise_chunk_count: 0,
				question_bank_chunk_count: 0,
				context_char_total: 0,
				exercise_char_total: 0,
				question_bank_char_total: 0,
				truncated: false,
			},
		};
	}

	const { data, error } = await admin
		.from("topic_context_chunks")
		.select("topic_id, content, chunk_type, source_ref, created_at")
		.in("topic_id", topicOrder)
		.order("topic_id", { ascending: true })
		.order("created_at", { ascending: true });

	if (error) {
		logServerError("fetchTopicContextChunksByTopicIds", error, { topicCount: topicOrder.length });
		void tagTopicContextFetchFailed();
		return {
			byTopic: new Map(),
			meta: {
				topic_count: topicOrder.length,
				context_chunk_count: 0,
				exercise_chunk_count: 0,
				question_bank_chunk_count: 0,
				context_char_total: 0,
				exercise_char_total: 0,
				question_bank_char_total: 0,
				truncated: false,
				fetch_error: "query_failed",
			},
		};
	}

	const orderedRows = sortRawChunksByTopicThenCreated((data ?? []) as RawTopicChunkRow[], topicOrder);

	const raw = new Map<string, TopicChunkBuckets>();

	for (const tid of topicOrder) {
		raw.set(tid, { context: [], exercise: [], questionBank: [] });
	}

	for (const row of orderedRows) {
		const bucket = raw.get(row.topic_id);
		if (!bucket) continue;
		const line: PracticeTopicChunkLine = { text: row.content, source_ref: row.source_ref };
		if (row.chunk_type === "context") {
			bucket.context.push(line);
		} else if (row.chunk_type === "exercise") {
			bucket.exercise.push(line);
		} else if (row.chunk_type === "question_bank") {
			bucket.questionBank.push(line);
		}
	}

	const { byTopic } = applyTopicContextLimits(raw, topicOrder);
	const meta = buildMeta(byTopic, topicOrder);
	logPracticeTopicContextStats(meta);
	return { byTopic, meta };
}
