import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Daily cache hit-rate + cost rollup for doubt-chat AI calls.
 *
 * Reads from the `ai_calls_doubt_cache_daily` view (migration
 * 20260628000000_doubt_chat_cache_rollup.sql). See that file for the why.
 *
 * `cache_hit_pct` is the share of *input* tokens served from DeepSeek's
 * prefix cache. A healthy doubt-chat after a few turns should sit at 70–90%+
 * because the system prompt + scope + prior conversation are stable across
 * turns. Low rates here are usually one of:
 *   - prompt template edit just shipped (transient — recovers as chats prime)
 *   - first-turn-of-a-new-chat skew (cohort imbalance)
 *   - mode toggles mid-chat invalidating the tail
 */
export type DoubtCacheDailyRow = {
	day: string;
	feature: string;
	model: string;
	provider: string | null;
	calls: number;
	inputTokensTotal: number;
	cacheHitTokensTotal: number;
	cacheMissTokensTotal: number;
	outputTokensTotal: number;
	reasoningTokensTotal: number;
	cacheHitPct: number | null;
	costInrTotal: number;
	latencyP50Ms: number | null;
	latencyP95Ms: number | null;
};

type RawRow = {
	day: string;
	feature: string;
	model: string;
	provider: string | null;
	calls: string | number;
	input_tokens_total: string | number;
	cache_hit_tokens_total: string | number;
	cache_miss_tokens_total: string | number;
	output_tokens_total: string | number;
	reasoning_tokens_total: string | number;
	cache_hit_pct: string | number | null;
	cost_inr_total: string | number;
	latency_p50_ms: string | number | null;
	latency_p95_ms: string | number | null;
};

function toNum(v: string | number | null | undefined): number {
	if (v == null) return 0;
	if (typeof v === "number") return v;
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}

function toNumOrNull(v: string | number | null | undefined): number | null {
	if (v == null) return null;
	if (typeof v === "number") return Number.isFinite(v) ? v : null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

/** Fetch the rollup for the last N days (default 30). */
export async function getDoubtCacheDailyRollup(days = 30): Promise<DoubtCacheDailyRow[]> {
	const safeDays = Math.max(1, Math.min(365, Math.trunc(days)));
	const result = await db.execute<RawRow>(sql`
		SELECT *
		FROM ai_calls_doubt_cache_daily
		WHERE day >= (current_date - ${sql.raw(String(safeDays))}::int)
		ORDER BY day DESC, feature ASC, model ASC
	`);
	const rows = (result as unknown as { rows?: RawRow[] }).rows ?? (result as unknown as RawRow[]);
	return rows.map((r) => ({
		day: r.day,
		feature: r.feature,
		model: r.model,
		provider: r.provider,
		calls: toNum(r.calls),
		inputTokensTotal: toNum(r.input_tokens_total),
		cacheHitTokensTotal: toNum(r.cache_hit_tokens_total),
		cacheMissTokensTotal: toNum(r.cache_miss_tokens_total),
		outputTokensTotal: toNum(r.output_tokens_total),
		reasoningTokensTotal: toNum(r.reasoning_tokens_total),
		cacheHitPct: toNumOrNull(r.cache_hit_pct),
		costInrTotal: toNum(r.cost_inr_total),
		latencyP50Ms: toNumOrNull(r.latency_p50_ms),
		latencyP95Ms: toNumOrNull(r.latency_p95_ms),
	}));
}

/**
 * Latest 7-day summary: aggregate cache hit rate + estimated savings.
 *
 * Savings vs the no-cache baseline: re-price cache-hit tokens at the
 * miss-tier rate (an upper bound on what the same workload would have cost
 * without DeepSeek's prefix cache).
 */
export type DoubtCacheSummary = {
	windowDays: number;
	calls: number;
	cacheHitPct: number | null;
	costInrTotal: number;
	estimatedSavingsInr: number;
};

const DEEPSEEK_V4_PRO_USD_PER_M_HIT = 0.003625;
const DEEPSEEK_V4_PRO_USD_PER_M_MISS = 0.435;
const USD_TO_INR_FALLBACK = 83;

function getUsdToInr(): number {
	const raw = process.env.AI_COST_USD_TO_INR;
	if (!raw) return USD_TO_INR_FALLBACK;
	const n = Number.parseFloat(raw);
	return Number.isFinite(n) && n > 0 ? n : USD_TO_INR_FALLBACK;
}

export async function getDoubtCacheSummary(windowDays = 7): Promise<DoubtCacheSummary> {
	const rows = await getDoubtCacheDailyRollup(windowDays);
	let calls = 0;
	let inputTokens = 0;
	let cacheHitTokens = 0;
	let costInr = 0;
	for (const r of rows) {
		calls += r.calls;
		inputTokens += r.inputTokensTotal;
		cacheHitTokens += r.cacheHitTokensTotal;
		costInr += r.costInrTotal;
	}
	const cacheHitPct = inputTokens > 0 ? Math.round((cacheHitTokens / inputTokens) * 10_000) / 100 : null;
	// Estimate what the cache-hit tokens would have cost at the miss-tier rate.
	const usdHit = (cacheHitTokens * DEEPSEEK_V4_PRO_USD_PER_M_HIT) / 1_000_000;
	const usdMiss = (cacheHitTokens * DEEPSEEK_V4_PRO_USD_PER_M_MISS) / 1_000_000;
	const savingsUsd = Math.max(0, usdMiss - usdHit);
	const savingsInr = Math.round(savingsUsd * getUsdToInr() * 10_000) / 10_000;
	return {
		windowDays,
		calls,
		cacheHitPct,
		costInrTotal: Math.round(costInr * 10_000) / 10_000,
		estimatedSavingsInr: savingsInr,
	};
}
