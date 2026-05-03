import "server-only";

/**
 * Cost per 1,000,000 tokens, in USD. Source: OpenAI public pricing as of
 * 2026-Q2. Update this table when model prices change. Unknown models return
 * null cost so the ai_calls.cost_inr column stays null when we cannot price
 * the call confidently — better than persisting a wrong number.
 */
export interface ModelPricing {
	/** USD per 1M input tokens. */
	input: number;
	/** USD per 1M output tokens. */
	output: number;
}

const DEFAULT_PRICING_USD: Record<string, ModelPricing> = {
	// OpenAI GPT-4o family
	"gpt-4o": { input: 2.5, output: 10.0 },
	"gpt-4o-mini": { input: 0.15, output: 0.6 },
	// GPT-5 family
	"gpt-5": { input: 5.0, output: 20.0 },
	"gpt-5-mini": { input: 0.5, output: 2.0 },
	"gpt-5.4": { input: 5.0, output: 20.0 },
	"gpt-5.4-mini": { input: 0.25, output: 1.0 },
	// Embeddings (output side is unused but priced for completeness)
	"text-embedding-3-small": { input: 0.02, output: 0 },
	"text-embedding-3-large": { input: 0.13, output: 0 },
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

/**
 * Compute the cost of an AI call in INR. Returns null when the model is
 * unknown or token counts are invalid, so callers can persist null rather
 * than a fabricated number.
 *
 * The ai_calls.cost_inr column is numeric(12, 4) so we round to 4 decimals.
 */
export function computeCostInr(
	model: string,
	inputTokens: number,
	outputTokens: number,
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
	const usd = (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
	const inr = usd * parseUsdToInr();
	return Math.round(inr * 10_000) / 10_000;
}
