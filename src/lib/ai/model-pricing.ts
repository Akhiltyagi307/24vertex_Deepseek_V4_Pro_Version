import "server-only";

/**
 * Cost per 1,000,000 tokens, in USD. Source: OpenAI + DeepSeek public pricing.
 *
 * DeepSeek bills input tokens at two tiers — `inputCacheMiss` for the first
 * sighting and `inputCacheHit` for tokens served from their on-disk prompt
 * cache (≈120x cheaper on V4 Pro). OpenAI's `input` rate is used for both
 * fields so a single code path handles either provider.
 *
 * Unknown models return null cost so `ai_calls.cost_inr` stays null when we
 * cannot price confidently — better than persisting a wrong number.
 */
export interface ModelPricing {
	/** USD per 1M input tokens (cache-miss). For providers without a cache split this is the only input rate. */
	inputCacheMiss: number;
	/** USD per 1M input tokens (cache-hit). Falls back to `inputCacheMiss` when the provider has no cache tier. */
	inputCacheHit: number;
	/** USD per 1M output tokens. Reasoning tokens are billed at this rate by both OpenAI and DeepSeek. */
	output: number;
}

const DEFAULT_PRICING_USD: Record<string, ModelPricing> = {
	// OpenAI GPT-4o family (no cache split exposed via this provider — same rate for both buckets).
	"gpt-4o": { inputCacheMiss: 2.5, inputCacheHit: 2.5, output: 10.0 },
	"gpt-4o-mini": { inputCacheMiss: 0.15, inputCacheHit: 0.15, output: 0.6 },
	// GPT-5 family
	"gpt-5": { inputCacheMiss: 5.0, inputCacheHit: 5.0, output: 20.0 },
	"gpt-5-mini": { inputCacheMiss: 0.5, inputCacheHit: 0.5, output: 2.0 },
	"gpt-5.4": { inputCacheMiss: 5.0, inputCacheHit: 5.0, output: 20.0 },
	"gpt-5.4-mini": { inputCacheMiss: 0.25, inputCacheHit: 0.25, output: 1.0 },
	// Embeddings (output side unused but priced for completeness)
	"text-embedding-3-small": { inputCacheMiss: 0.02, inputCacheHit: 0.02, output: 0 },
	"text-embedding-3-large": { inputCacheMiss: 0.13, inputCacheHit: 0.13, output: 0 },
	// DeepSeek V4 family — pricing as of 2026-05-25. The 75% promotional
	// discount becomes the permanent rate on 2026-05-31, which is what these
	// numbers reflect. If the promo lapses without a re-up, revert to the
	// pre-discount values (1.74 / 0.0145 / 3.48) for v4-pro.
	"deepseek-v4-pro": { inputCacheMiss: 0.435, inputCacheHit: 0.003625, output: 0.87 },
	"deepseek-v4-flash": { inputCacheMiss: 0.14, inputCacheHit: 0.0028, output: 0.28 },
	// Legacy DeepSeek names — auto-mapped server-side by DeepSeek until 2026-07-24.
	"deepseek-chat": { inputCacheMiss: 0.14, inputCacheHit: 0.0028, output: 0.28 },
	"deepseek-reasoner": { inputCacheMiss: 0.14, inputCacheHit: 0.0028, output: 0.28 },
};

const DEFAULT_USD_TO_INR = 83;

function parseUsdToInr(): number {
	const raw = process.env.AI_COST_USD_TO_INR;
	if (!raw) return DEFAULT_USD_TO_INR;
	const n = Number.parseFloat(raw);
	return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_TO_INR;
}

function lookupPricing(model: string): ModelPricing | null {
	const lower = model.toLowerCase();
	const direct = DEFAULT_PRICING_USD[lower];
	if (direct) return direct;
	// Fuzzy match: strip a trailing date suffix like -2024-08-06.
	const base = lower.replace(/-20\d{2}-\d{2}-\d{2}$/, "");
	const matched = DEFAULT_PRICING_USD[base];
	return matched ?? null;
}

export type ComputeCostBreakdown = {
	/** Input tokens that hit the provider's prompt cache. Pass 0 when unknown. */
	cacheHitTokens?: number | null;
	/** Input tokens that missed the prompt cache (regular billing tier). */
	cacheMissTokens?: number | null;
};

/**
 * Compute the cost of an AI call in INR. Returns null when the model is
 * unknown or token counts are invalid.
 *
 * Token accounting:
 * - When `breakdown` is omitted (the common OpenAI path), `inputTokens` is
 *   billed entirely at the cache-miss rate, which equals the cache-hit rate
 *   for providers without a cache split — same total either way.
 * - When `breakdown.cacheHitTokens` + `breakdown.cacheMissTokens` are
 *   provided (DeepSeek path), each bucket is billed at its own rate. If the
 *   buckets don't sum to `inputTokens` (e.g. one is null), the remainder is
 *   billed at the cache-miss rate so we never under-bill on partial data.
 *
 * The ai_calls.cost_inr column is numeric(12, 4) so we round to 4 decimals.
 */
export function computeCostInr(
	model: string,
	inputTokens: number,
	outputTokens: number,
	breakdown?: ComputeCostBreakdown,
): number | null {
	if (
		!Number.isFinite(inputTokens) ||
		!Number.isFinite(outputTokens) ||
		inputTokens < 0 ||
		outputTokens < 0
	) {
		return null;
	}
	const p = lookupPricing(model);
	if (!p) return null;

	const cacheHit = Math.max(0, breakdown?.cacheHitTokens ?? 0);
	const cacheMiss = Math.max(0, breakdown?.cacheMissTokens ?? 0);
	const buckets = cacheHit + cacheMiss;
	// Remainder is everything the provider didn't bucket — treated as cache-miss.
	const remainder = Math.max(0, inputTokens - buckets);

	const usd =
		(cacheHit * p.inputCacheHit +
			(cacheMiss + remainder) * p.inputCacheMiss +
			outputTokens * p.output) /
		1_000_000;
	const inr = usd * parseUsdToInr();
	return Math.round(inr * 10_000) / 10_000;
}
