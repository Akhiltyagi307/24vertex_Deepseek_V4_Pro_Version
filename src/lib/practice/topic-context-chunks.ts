import type { SupabaseClient } from "@supabase/supabase-js";

import { logServerError } from "@/lib/server/log-supabase-error";

import { tagTopicContextFetchFailed } from "./sentry-tags";
import type { PracticeGroundingMeta, PracticeTopicChunkLine, PreFetchedTopicContext } from "./user-message";

/** Tunable limits for practice prompt size (per-topic then global trim). */
export const TOPIC_CONTEXT_DEFAULT_LIMITS = {
	maxContextChunksPerTopic: 12,
	maxExerciseChunksPerTopic: 10,
	maxContextCharsPerTopic: 4000,
	maxExerciseCharsPerTopic: 3500,
	maxTotalContextChars: 22_000,
	maxTotalExerciseChars: 16_000,
} as const;

export type TopicContextLimits = {
	maxContextChunksPerTopic: number;
	maxExerciseChunksPerTopic: number;
	maxContextCharsPerTopic: number;
	maxExerciseCharsPerTopic: number;
	maxTotalContextChars: number;
	maxTotalExerciseChars: number;
};

const DEFAULT_LIMITS: TopicContextLimits = { ...TOPIC_CONTEXT_DEFAULT_LIMITS };

/** Hard ceiling so misconfigured env cannot OOM a Node process. */
const ENV_LIMIT_CEILING = 500_000;

function parseEnvPositiveInt(name: string, fallback: number, max: number): number {
	const raw = process.env[name];
	if (raw == null || raw === "") return fallback;
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n) || n < 0) return fallback;
	return Math.min(n, max);
}

/**
 * Optional env overrides (see `.env.example`). Invalid values fall back to defaults.
 */
export function getTopicContextLimitsFromEnv(): TopicContextLimits {
	return {
		maxContextChunksPerTopic: parseEnvPositiveInt(
			"PRACTICE_TOPIC_CONTEXT_MAX_CONTEXT_CHUNKS_PER_TOPIC",
			DEFAULT_LIMITS.maxContextChunksPerTopic,
			10_000,
		),
		maxExerciseChunksPerTopic: parseEnvPositiveInt(
			"PRACTICE_TOPIC_CONTEXT_MAX_EXERCISE_CHUNKS_PER_TOPIC",
			DEFAULT_LIMITS.maxExerciseChunksPerTopic,
			10_000,
		),
		maxContextCharsPerTopic: parseEnvPositiveInt(
			"PRACTICE_TOPIC_CONTEXT_MAX_CONTEXT_CHARS_PER_TOPIC",
			DEFAULT_LIMITS.maxContextCharsPerTopic,
			ENV_LIMIT_CEILING,
		),
		maxExerciseCharsPerTopic: parseEnvPositiveInt(
			"PRACTICE_TOPIC_CONTEXT_MAX_EXERCISE_CHARS_PER_TOPIC",
			DEFAULT_LIMITS.maxExerciseCharsPerTopic,
			ENV_LIMIT_CEILING,
		),
		maxTotalContextChars: parseEnvPositiveInt(
			"PRACTICE_TOPIC_CONTEXT_MAX_TOTAL_CONTEXT_CHARS",
			DEFAULT_LIMITS.maxTotalContextChars,
			ENV_LIMIT_CEILING,
		),
		maxTotalExerciseChars: parseEnvPositiveInt(
			"PRACTICE_TOPIC_CONTEXT_MAX_TOTAL_EXERCISE_CHARS",
			DEFAULT_LIMITS.maxTotalExerciseChars,
			ENV_LIMIT_CEILING,
		),
	};
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

type RawChunk = RawTopicChunkRow;

function charSum(lines: PracticeTopicChunkLine[]): number {
	return lines.reduce((a, c) => a + c.text.length, 0);
}

/**
 * Per-topic cap (chunk count + char budget), then global char trim by dropping
 * from the end of the last topics (canonical order preserved for remaining chunks).
 * Exported for unit tests.
 */
export function applyTopicContextLimits(
	raw: Map<string, { context: PracticeTopicChunkLine[]; exercise: PracticeTopicChunkLine[] }>,
	topicOrder: string[],
	limits: TopicContextLimits = DEFAULT_LIMITS,
): { byTopic: Map<string, { context: PracticeTopicChunkLine[]; exercise: PracticeTopicChunkLine[] }>; truncated: boolean } {
	const byTopic = new Map<string, { context: PracticeTopicChunkLine[]; exercise: PracticeTopicChunkLine[] }>();

	for (const tid of topicOrder) {
		const b = raw.get(tid) ?? { context: [], exercise: [] };
		byTopic.set(tid, { context: [...b.context], exercise: [...b.exercise] });
	}

	let truncated = false;

	for (const tid of topicOrder) {
		const b = byTopic.get(tid);
		if (!b) continue;

		const capList = (arr: PracticeTopicChunkLine[], maxChunks: number, maxChars: number) => {
			const out: PracticeTopicChunkLine[] = [];
			let chars = 0;
			for (const line of arr) {
				if (out.length >= maxChunks) {
					truncated = true;
					break;
				}
				const nextLen = line.text.length;
				if (chars + nextLen > maxChars) {
					truncated = true;
					break;
				}
				out.push(line);
				chars += nextLen;
			}
			if (out.length < arr.length) truncated = true;
			return out;
		};

		b.context = capList(b.context, limits.maxContextChunksPerTopic, limits.maxContextCharsPerTopic);
		b.exercise = capList(b.exercise, limits.maxExerciseChunksPerTopic, limits.maxExerciseCharsPerTopic);
	}

	const trimGlobal = (kind: "context" | "exercise", maxGlobal: number) => {
		let total = 0;
		for (const tid of topicOrder) {
			const b = byTopic.get(tid);
			if (b) total += charSum(b[kind]);
		}
		if (total <= maxGlobal) return;
		for (const tid of [...topicOrder].reverse()) {
			const b = byTopic.get(tid);
			if (!b) continue;
			const arr = b[kind];
			while (arr.length > 0 && total > maxGlobal) {
				const removed = arr.pop()!;
				total -= removed.text.length;
				truncated = true;
			}
			if (total <= maxGlobal) return;
		}
	};

	trimGlobal("context", limits.maxTotalContextChars);
	trimGlobal("exercise", limits.maxTotalExerciseChars);

	return { byTopic, truncated };
}

function buildMeta(
	byTopic: Map<string, { context: PracticeTopicChunkLine[]; exercise: PracticeTopicChunkLine[] }>,
	topicOrder: string[],
	truncated: boolean,
	fetchError?: string,
): PracticeGroundingMeta {
	let contextChunkCount = 0;
	let exerciseChunkCount = 0;
	let contextCharTotal = 0;
	let exerciseCharTotal = 0;
	for (const tid of topicOrder) {
		const b = byTopic.get(tid);
		if (!b) continue;
		contextChunkCount += b.context.length;
		exerciseChunkCount += b.exercise.length;
		contextCharTotal += charSum(b.context);
		exerciseCharTotal += charSum(b.exercise);
	}
	return {
		topic_count: topicOrder.length,
		context_chunk_count: contextChunkCount,
		exercise_chunk_count: exerciseChunkCount,
		context_char_total: contextCharTotal,
		exercise_char_total: exerciseCharTotal,
		truncated,
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
			context_chars: meta.context_char_total,
			exercise_chars: meta.exercise_char_total,
			truncated: meta.truncated,
			fetch_error: meta.fetch_error ?? null,
		});
		return;
	}
	console.info(
		`[${context}] topic_count=${meta.topic_count} context_chunks=${meta.context_chunk_count} exercise_chunks=${meta.exercise_chunk_count} context_chars=${meta.context_char_total} exercise_chars=${meta.exercise_char_total} truncated=${meta.truncated}`,
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
	limits: TopicContextLimits = getTopicContextLimitsFromEnv(),
): Promise<PreFetchedTopicContext> {
	const topicOrder = [...topicIds];
	if (topicOrder.length === 0) {
		return {
			byTopic: new Map(),
			meta: {
				topic_count: 0,
				context_chunk_count: 0,
				exercise_chunk_count: 0,
				context_char_total: 0,
				exercise_char_total: 0,
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
				context_char_total: 0,
				exercise_char_total: 0,
				truncated: false,
				fetch_error: "query_failed",
			},
		};
	}

	const orderedRows = sortRawChunksByTopicThenCreated((data ?? []) as RawChunk[], topicOrder);

	const raw = new Map<string, { context: PracticeTopicChunkLine[]; exercise: PracticeTopicChunkLine[] }>();

	for (const tid of topicOrder) {
		raw.set(tid, { context: [], exercise: [] });
	}

	for (const row of orderedRows) {
		const bucket = raw.get(row.topic_id);
		if (!bucket) continue;
		const line: PracticeTopicChunkLine = { text: row.content, source_ref: row.source_ref };
		if (row.chunk_type === "context") {
			bucket.context.push(line);
		} else if (row.chunk_type === "exercise") {
			bucket.exercise.push(line);
		}
	}

	const { byTopic, truncated } = applyTopicContextLimits(raw, topicOrder, limits);
	const meta = buildMeta(byTopic, topicOrder, truncated);
	logPracticeTopicContextStats(meta);
	return { byTopic, meta };
}
