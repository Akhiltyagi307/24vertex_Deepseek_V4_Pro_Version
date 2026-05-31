import "server-only";

import type { LanguageModel } from "ai";

import type { ProviderOptions } from "./deepseek-provider";

import {
	getDeepSeekBlueprintModel,
	getDeepSeekDoubtChatModel,
	getDeepSeekGradeSummaryModel,
	getDeepSeekGradingChatModel,
	getDeepSeekPracticeChatModel,
	getDeepSeekValidationModel,
	getDeepSeekVisualEnrichmentModel,
	getOpenAIChatModel,
	getOpenAIDoubtChatModel,
	getOpenAIPracticeChatModel,
} from "@/lib/env";

import {
	deepseekThinkingProviderOptions,
	getDeepSeekProvider,
	isThinkingActiveForFeature,
} from "./deepseek-provider";
import { getOpenAIProvider } from "./openai-provider";

/**
 * Feature keys recognised by the router. Adding a new structured-output
 * call site should add a key here so it can be routed independently via
 * `AI_PROVIDER_<FEATURE>` env override during the gradual rollout.
 */
export type AiFeatureKey =
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

export type AiProvider = "openai" | "deepseek";

export type ResolvedAiModel = {
	provider: AiProvider;
	modelId: string;
	model: LanguageModel;
	/**
	 * `providerOptions` shape that should be spread into the SDK call. For
	 * DeepSeek this contains the thinking-mode + reasoning_effort options; for
	 * OpenAI it's an empty object so call sites can still merge their own
	 * provider-specific options (e.g. `{ openai: { strictJsonSchema: true } }`).
	 */
	providerOptions: ProviderOptions;
	/**
	 * True when the SDK provider supports `generateObject` / `streamObject`
	 * natively (today: OpenAI only). The structured-output adapter forks on
	 * this flag.
	 */
	supportsNativeObjectGeneration: boolean;
	/**
	 * Whether this call will actually spend CoT tokens. The structured-output
	 * adapter uses this to decide whether to inflate maxOutputTokens. Only
	 * meaningful when `provider === "deepseek"`.
	 */
	thinkingActive: boolean;
};

/**
 * Reads `AI_PROVIDER_<FEATURE>` first, falls back to `AI_PROVIDER_DEFAULT`,
 * else "openai". Feature key is upper-snake-cased: `practice.grade.chunk`
 * becomes `AI_PROVIDER_PRACTICE_GRADE_CHUNK`. Unknown values silently fall
 * back to "openai" — we never want a misconfig to crash a hot request path.
 */
function resolveProviderFromEnv(feature: AiFeatureKey): AiProvider {
	const envKey = `AI_PROVIDER_${feature.toUpperCase().replace(/\./g, "_")}`;
	const featureOverride = process.env[envKey]?.trim().toLowerCase();
	const fallback = process.env.AI_PROVIDER_DEFAULT?.trim().toLowerCase();
	const chosen = featureOverride || fallback || "openai";
	return chosen === "deepseek" ? "deepseek" : "openai";
}

function openaiModelIdForFeature(feature: AiFeatureKey): string {
	switch (feature) {
		case "doubt.chat":
			return getOpenAIDoubtChatModel();
		case "practice.generation":
		case "practice.generation.blueprint":
		case "practice.generation.repair":
		case "practice.generation.visual_enrichment":
		case "practice.generation.validation":
			return getOpenAIPracticeChatModel();
		case "practice.grade.chunk":
		case "practice.grade.summary":
		case "teacher.dashboard_insight":
		case "teacher.at_risk_intervention":
			return getOpenAIChatModel();
		default: {
			const _exhaustive: never = feature;
			void _exhaustive;
			return getOpenAIChatModel();
		}
	}
}

function deepseekModelIdForFeature(feature: AiFeatureKey): string {
	switch (feature) {
		case "doubt.chat":
			return getDeepSeekDoubtChatModel();
		// Structural / formatting calls — route to Flash by default when the
		// per-feature env var is set; otherwise inherit the practice model.
		case "practice.generation.blueprint":
			return getDeepSeekBlueprintModel();
		case "practice.generation.visual_enrichment":
			return getDeepSeekVisualEnrichmentModel();
		case "practice.generation.validation":
			return getDeepSeekValidationModel();
		case "practice.grade.summary":
		// Teacher-portal narration: short, structured prose over already-computed
		// analytics. The lightweight summary model is the right cost/quality fit.
		case "teacher.dashboard_insight":
		case "teacher.at_risk_intervention":
			return getDeepSeekGradeSummaryModel();
		// Quality-critical content paths stay on the practice/grading model
		// (Pro by default).
		case "practice.generation":
		case "practice.generation.repair":
			return getDeepSeekPracticeChatModel();
		case "practice.grade.chunk":
			return getDeepSeekGradingChatModel();
		default: {
			const _exhaustive: never = feature;
			void _exhaustive;
			return getDeepSeekPracticeChatModel();
		}
	}
}

export type ResolveChatModelOptions = {
	/**
	 * For doubt chat: when the current turn has an image attachment, the
	 * router forces OpenAI because `@ai-sdk/deepseek` does not list image
	 * input in its capability table. PDFs do NOT trigger this — they go
	 * through server-side text extraction (pdf-parse → pdfjs-dist → OCR) and
	 * the resulting transcript is prepended to the user message, so DeepSeek
	 * handles PDF-only turns natively.
	 *
	 * Other features ignore this flag.
	 */
	hasImageAttachment?: boolean;
};

/**
 * Pick the chat model for a feature. The returned `model` is ready to pass to
 * Vercel AI SDK `generateText` / `streamText` / `generateObject` / `streamObject`
 * (with the caveat that DeepSeek doesn't support the *Object variants — the
 * structured-output adapter handles that bifurcation).
 */
export function resolveChatModel(
	feature: AiFeatureKey,
	opts: ResolveChatModelOptions = {},
): ResolvedAiModel {
	const envProvider = resolveProviderFromEnv(feature);

	// Vision turns force OpenAI regardless of feature flag — see decision
	// matrix in docs/deepseek-migration-plan.md §4.1. PDFs route to the env
	// provider (DeepSeek by default) because text extraction happens upstream.
	const provider: AiProvider =
		feature === "doubt.chat" && opts.hasImageAttachment === true ? "openai" : envProvider;

	if (provider === "deepseek") {
		const modelId = deepseekModelIdForFeature(feature);
		return {
			provider: "deepseek",
			modelId,
			model: getDeepSeekProvider().chat(modelId),
			providerOptions: deepseekThinkingProviderOptions(feature),
			supportsNativeObjectGeneration: false,
			thinkingActive: isThinkingActiveForFeature(feature),
		};
	}

	const modelId = openaiModelIdForFeature(feature);
	return {
		provider: "openai",
		modelId,
		model: getOpenAIProvider().chat(modelId),
		providerOptions: {},
		supportsNativeObjectGeneration: true,
		thinkingActive: false,
	};
}

/**
 * Lighter-weight resolver for the embeddings path — DeepSeek has no embeddings
 * API so embeddings always run on OpenAI. Centralised here so the call site
 * doesn't need to know about provider gymnastics. Returns a text-embedding
 * model handle ready for `embedMany`.
 *
 * NOTE: kept exported even though the dedup callers were removed in Phase 2,
 * because future features (semantic search, content moderation) may still
 * want embeddings without re-introducing OpenAI knowledge there.
 */
export function resolveEmbeddingModel(modelId: string) {
	return getOpenAIProvider().textEmbeddingModel(modelId);
}

/**
 * Construct an explicit OpenAI-backed `ResolvedAiModel` for a given model ID,
 * bypassing the router. Used by the practice-generation fallback path: when
 * the primary call 429s/503s, we retry on the configured OpenAI fallback model
 * regardless of which provider the router would have picked. DeepSeek has no
 * structured-output fallback today, so this stays OpenAI-only.
 */
export function buildOpenAiResolved(modelId: string): ResolvedAiModel {
	return {
		provider: "openai",
		modelId,
		model: getOpenAIProvider().chat(modelId),
		providerOptions: {},
		supportsNativeObjectGeneration: true,
		thinkingActive: false,
	};
}
