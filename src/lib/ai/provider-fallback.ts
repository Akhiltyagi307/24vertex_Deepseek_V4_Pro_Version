import "server-only";

import { APICallError, streamText } from "ai";

import { getOpenAIPracticeChatModelFallback, isAiProviderFallbackEnabled } from "@/lib/env";
import { logServerError } from "@/lib/server/log-supabase-error";

import { buildOpenAiResolved, type ResolvedAiModel } from "./model-router";

const RETRYABLE_MESSAGE_PATTERN =
	/\b(rate[ -]?limit(?:ed|ing)?|overloaded|timeout|capacity)\b/i;

export type ProviderFallbackContext = {
	primary: ResolvedAiModel;
	error: unknown;
	feature?: string;
};

export type ProviderFallbackTelemetry = {
	primaryProvider: "deepseek";
	primaryModelId: string;
	fallbackModelId: string;
	reason: string;
};

/** True unless `AI_PROVIDER_FALLBACK_ENABLED=false`. */
export function isProviderFallbackEnabled(): boolean {
	return isAiProviderFallbackEnabled();
}

export function isRetryableProviderError(error: unknown): boolean {
	if (APICallError.isInstance(error)) {
		const code = error.statusCode;
		if (code === 429 || code === 503 || code === 504) return true;
		return false;
	}
	if (error instanceof Error) {
		if ((error as { code?: string }).code === "deepseek_structured_failure") {
			return false;
		}
		if (RETRYABLE_MESSAGE_PATTERN.test(error.message)) return true;
	}
	return false;
}

export function formatProviderErrorForLog(error: unknown): string {
	if (APICallError.isInstance(error)) {
		const head = error.message.trim().split(/\r?\n/)[0] ?? error.message;
		return `status=${error.statusCode} ${head}`.slice(0, 320);
	}
	if (error instanceof Error) return error.message.slice(0, 320);
	return String(error).slice(0, 320);
}

export function providerFallbackReason(error: unknown): string {
	if (APICallError.isInstance(error)) {
		return String(error.statusCode ?? "api_error");
	}
	if (error instanceof Error) return error.message.slice(0, 120);
	return "unknown";
}

export function resolveOpenAiFallbackModel(): string | null {
	if (!isProviderFallbackEnabled()) return null;
	return getOpenAIPracticeChatModelFallback();
}

/** OpenAI resolved model for cross-provider fallback, or null when unavailable. */
export function resolveOpenAiFallbackResolved(): ResolvedAiModel | null {
	const modelId = resolveOpenAiFallbackModel();
	if (!modelId) return null;
	try {
		return buildOpenAiResolved(modelId);
	} catch (e) {
		logServerError("resolveOpenAiFallbackResolved", e, { modelId });
		return null;
	}
}

export function shouldAttemptProviderFallback(ctx: ProviderFallbackContext): boolean {
	if (!isProviderFallbackEnabled()) return false;
	if (ctx.primary.provider !== "deepseek") return false;
	if (!isRetryableProviderError(ctx.error)) return false;
	return resolveOpenAiFallbackResolved() !== null;
}

export function logProviderFallbackAttempt(args: {
	feature: string;
	primaryModelId: string;
	fallbackModelId: string;
	error: unknown;
}): void {
	logServerError(
		"ai.providerFallback",
		`Primary ${args.primaryModelId} failed retryably; retrying with ${args.fallbackModelId}.`,
		{
			feature: args.feature,
			primaryError: formatProviderErrorForLog(args.error),
		},
	);
}

export function buildProviderFallbackTelemetry(
	primary: ResolvedAiModel,
	fallbackModelId: string,
	error: unknown,
): ProviderFallbackTelemetry {
	return {
		primaryProvider: "deepseek",
		primaryModelId: primary.modelId,
		fallbackModelId,
		reason: providerFallbackReason(error),
	};
}

type StreamTextParams = Parameters<typeof streamText>[0];

export type StreamTextWithProviderFallbackArgs = {
	feature: string;
	resolved: ResolvedAiModel;
	streamArgs: Omit<StreamTextParams, "model" | "providerOptions">;
};

export type StreamTextWithProviderFallbackResult = {
	result: ReturnType<typeof streamText>;
	resolved: ResolvedAiModel;
	modelId: string;
	providerFallback?: ProviderFallbackTelemetry;
};

/**
 * Starts a `streamText` call on the primary model; on synchronous setup failure
 * or immediate throw, retries once on the configured OpenAI fallback model.
 */
export function streamTextWithProviderFallback(
	args: StreamTextWithProviderFallbackArgs,
): StreamTextWithProviderFallbackResult {
	const run = (resolved: ResolvedAiModel) =>
		streamText({
			...args.streamArgs,
			model: resolved.model,
			providerOptions: resolved.providerOptions,
		});

	try {
		return {
			result: run(args.resolved),
			resolved: args.resolved,
			modelId: args.resolved.modelId,
		};
	} catch (primaryError) {
		if (!shouldAttemptProviderFallback({ primary: args.resolved, error: primaryError, feature: args.feature })) {
			throw primaryError;
		}
		const fallbackResolved = resolveOpenAiFallbackResolved();
		if (!fallbackResolved) throw primaryError;
		logProviderFallbackAttempt({
			feature: args.feature,
			primaryModelId: args.resolved.modelId,
			fallbackModelId: fallbackResolved.modelId,
			error: primaryError,
		});
		return {
			result: run(fallbackResolved),
			resolved: fallbackResolved,
			modelId: fallbackResolved.modelId,
			providerFallback: buildProviderFallbackTelemetry(
				args.resolved,
				fallbackResolved.modelId,
				primaryError,
			),
		};
	}
}
