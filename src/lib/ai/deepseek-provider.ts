import "server-only";

import { createDeepSeek } from "@ai-sdk/deepseek";
import type { JSONValue } from "ai";

import {
	getDeepSeekApiKey,
	getDeepSeekBaseUrl,
	getDeepSeekBlueprintThinking,
	getDeepSeekGradeSummaryThinking,
	getDeepSeekReasoningEffort,
	getDeepSeekValidationThinking,
	getDeepSeekVisualEnrichmentThinking,
	type DeepSeekThinkingMode,
} from "@/lib/env";

/**
 * Provider-options shape used across the AI layer. Matches `SharedV3ProviderOptions`
 * from `@ai-sdk/provider`: a map from provider name (e.g. "deepseek", "openai") to a
 * provider-specific JSON-compatible options bag. Local alias because the SDK's
 * `ProviderOptions` symbol isn't exported from the `ai` barrel and the underlying
 * `@ai-sdk/provider-utils` package isn't a direct project dep.
 */
export type ProviderOptions = Record<string, Record<string, JSONValue>>;

let provider: ReturnType<typeof createDeepSeek> | null = null;

/**
 * DeepSeek chat models via `@ai-sdk/deepseek`. Lazily initialised so adding the
 * dep does not require `DEEPSEEK_API_KEY` to be set in deployments that still
 * route every feature to OpenAI (the Phase 1 default).
 *
 * Cleared on getter throw so a transient env-misconfig at boot doesn't lock us
 * out after the env var is fixed — the next call will re-attempt.
 */
export function getDeepSeekProvider() {
	if (!provider) {
		provider = createDeepSeek({
			apiKey: getDeepSeekApiKey(),
			baseURL: getDeepSeekBaseUrl(),
		});
	}
	return provider;
}

/**
 * Provider options blob for a "thinking enabled" call. Pass into
 * `generateText` / `streamText` / our `generateStructured` adapter as
 * `providerOptions`. The structure mirrors the @ai-sdk/deepseek README.
 *
 * Reasoning effort is read at call time (not module init) so an env flip via
 * `DEEPSEEK_REASONING_EFFORT` takes effect on the next request without
 * redeploying — important for tuning during rollout.
 */
/**
 * Feature keys the per-call thinking-mode selector understands. Any other
 * value falls through to the "default" (enabled) behaviour. Keep narrow on
 * purpose — opting a feature in/out of thinking is a deliberate policy
 * decision, not a free-form override.
 */
export type DeepSeekThinkingFeature =
	| "practice.generation"
	| "practice.generation.blueprint"
	| "practice.generation.repair"
	| "practice.generation.visual_enrichment"
	| "practice.generation.validation"
	| "practice.grade.chunk"
	| "practice.grade.summary"
	| "doubt.chat"
	| "teacher.dashboard_insight"
	| "teacher.at_risk_intervention";

/**
 * Returns the thinking mode for a given feature key. Only the three structural
 * features (blueprint / visual_enrichment / grade.summary) have env overrides
 * today; everything else stays on `enabled` (the V4 Pro default).
 */
function thinkingModeForFeature(feature: DeepSeekThinkingFeature | undefined): DeepSeekThinkingMode {
	if (feature === "practice.generation.blueprint") return getDeepSeekBlueprintThinking();
	if (feature === "practice.generation.visual_enrichment") return getDeepSeekVisualEnrichmentThinking();
	if (feature === "practice.generation.validation") return getDeepSeekValidationThinking();
	if (feature === "practice.grade.summary") return getDeepSeekGradeSummaryThinking();
	return "enabled";
}

/**
 * Build providerOptions for a DeepSeek call. When `feature` is provided, the
 * thinking mode is selected per-feature so blueprint / visual enrichment /
 * grade summary can be flipped to `disabled` independently of the
 * quality-critical practice.generation + practice.grade.chunk paths.
 *
 * `reasoningEffort` is still applied when thinking is enabled or adaptive;
 * harmless (and ignored by the SDK) when thinking is disabled.
 */
export function deepseekThinkingProviderOptions(
	feature?: DeepSeekThinkingFeature,
): ProviderOptions {
	const mode = thinkingModeForFeature(feature);
	return {
		deepseek: {
			thinking: { type: mode },
			reasoningEffort: getDeepSeekReasoningEffort(),
		},
	};
}

/**
 * True when a call would actually consume CoT tokens. The structured-output
 * adapter uses this to decide whether to inflate `maxOutputTokens` — calls
 * with thinking disabled don't need the 3× headroom.
 */
export function isThinkingActiveForFeature(feature?: DeepSeekThinkingFeature): boolean {
	const mode = thinkingModeForFeature(feature);
	return mode !== "disabled";
}

/**
 * Extract a sane `reasoning_tokens` value from a Vercel-AI-SDK `usage` object.
 *
 * AI SDK 6 nests reasoning under `usage.outputTokenDetails.reasoningTokens`.
 * Older builds (and some providers) surface it as a flat `usage.reasoningTokens`,
 * so we check both. Returns null when neither is populated — we never want to
 * persist a fabricated zero, because zero is meaningful (e.g. a non-reasoning
 * model truly used 0 reasoning tokens).
 */
export function extractReasoningTokens(
	usage:
		| {
				reasoningTokens?: number | null;
				outputTokenDetails?: { reasoningTokens?: number | null };
		  }
		| null
		| undefined,
): number | null {
	if (!usage) return null;
	const nested = usage.outputTokenDetails?.reasoningTokens;
	if (typeof nested === "number" && Number.isFinite(nested) && nested >= 0) return nested;
	const flat = usage.reasoningTokens;
	if (typeof flat === "number" && Number.isFinite(flat) && flat >= 0) return flat;
	return null;
}

/**
 * Extract prompt-cache hit/miss split from DeepSeek provider metadata.
 * Returns null tokens when the metadata is absent so callers can default
 * to "all cache-miss" for cost calculation.
 */
export function extractDeepSeekCacheTokens(
	providerMetadata: Record<string, unknown> | null | undefined,
): { cacheHitTokens: number | null; cacheMissTokens: number | null } {
	const ds = providerMetadata?.deepseek;
	if (!ds || typeof ds !== "object") {
		return { cacheHitTokens: null, cacheMissTokens: null };
	}
	const obj = ds as Record<string, unknown>;
	const hit = obj.promptCacheHitTokens;
	const miss = obj.promptCacheMissTokens;
	return {
		cacheHitTokens: typeof hit === "number" && Number.isFinite(hit) ? hit : null,
		cacheMissTokens: typeof miss === "number" && Number.isFinite(miss) ? miss : null,
	};
}
