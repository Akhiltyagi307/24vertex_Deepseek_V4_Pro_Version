import { APICallError } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ResolvedAiModel } from "../model-router";
import {
	__testOnly,
	generateStructuredWithProviderFallback,
} from "../structured-output";

const deepseekResolved: ResolvedAiModel = {
	provider: "deepseek",
	modelId: "deepseek-v4-pro",
	model: {} as ResolvedAiModel["model"],
	providerOptions: {},
	supportsNativeObjectGeneration: false,
	thinkingActive: false,
};

const openaiResolved: ResolvedAiModel = {
	provider: "openai",
	modelId: "gpt-5.4-mini",
	model: {} as ResolvedAiModel["model"],
	providerOptions: {},
	supportsNativeObjectGeneration: true,
	thinkingActive: false,
};

const sampleSchema = z.object({ answer: z.string() });

afterEach(() => {
	vi.unstubAllEnvs();
	__testOnly.setGenerateStructuredDelegate(undefined);
});

describe("generateStructuredWithProviderFallback", () => {
	it("returns primary result without fallback on success", async () => {
		const delegate = vi.fn().mockResolvedValueOnce({
			object: { answer: "ok" },
			usage: { inputTokens: 1, outputTokens: 2 },
			telemetry: {
				provider: "deepseek",
				modelId: "deepseek-v4-pro",
				reasoningTokens: null,
				cacheHitTokens: null,
				cacheMissTokens: null,
			},
		});
		__testOnly.setGenerateStructuredDelegate(delegate);

		const result = await generateStructuredWithProviderFallback({
			resolved: deepseekResolved,
			schema: sampleSchema,
			system: "sys",
			prompt: "prompt",
			feature: "test.feature",
		});

		expect(delegate).toHaveBeenCalledTimes(1);
		expect(result.object).toEqual({ answer: "ok" });
		expect(result.telemetry.providerFallback).toBeUndefined();
	});

	it("retries on OpenAI when primary throws retryable APICallError", async () => {
		vi.stubEnv("OPENAI_API_KEY", "sk-test");
		vi.stubEnv("OPENAI_CHAT_MODEL_FALLBACK", "gpt-5.4-mini");

		const rateLimit = new APICallError({
			message: "rate limited",
			url: "https://api.deepseek.com",
			requestBodyValues: {},
			statusCode: 429,
			responseHeaders: {},
			responseBody: "",
			isRetryable: true,
		});

		const delegate = vi
			.fn()
			.mockRejectedValueOnce(rateLimit)
			.mockResolvedValueOnce({
				object: { answer: "fallback" },
				usage: { inputTokens: 3, outputTokens: 4 },
				telemetry: {
					provider: "openai",
					modelId: "gpt-5.4-mini",
					reasoningTokens: null,
					cacheHitTokens: null,
					cacheMissTokens: null,
				},
			});
		__testOnly.setGenerateStructuredDelegate(delegate);

		const result = await generateStructuredWithProviderFallback({
			resolved: deepseekResolved,
			schema: sampleSchema,
			system: "sys",
			prompt: "prompt",
			feature: "practice.generation",
		});

		expect(delegate).toHaveBeenCalledTimes(2);
		expect(delegate.mock.calls[1]?.[0]?.resolved?.provider).toBe("openai");
		expect(result.object).toEqual({ answer: "fallback" });
		expect(result.telemetry.providerFallback?.fallbackModelId).toBe("gpt-5.4-mini");
	});

	it("does not fallback for openai primary", async () => {
		vi.stubEnv("OPENAI_API_KEY", "sk-test");
		vi.stubEnv("OPENAI_CHAT_MODEL_FALLBACK", "gpt-5.4-mini");

		const rateLimit = new APICallError({
			message: "rate limited",
			url: "https://api.openai.com",
			requestBodyValues: {},
			statusCode: 429,
			responseHeaders: {},
			responseBody: "",
			isRetryable: true,
		});

		const delegate = vi.fn().mockRejectedValueOnce(rateLimit);
		__testOnly.setGenerateStructuredDelegate(delegate);

		await expect(
			generateStructuredWithProviderFallback({
				resolved: openaiResolved,
				schema: sampleSchema,
				system: "sys",
				prompt: "prompt",
			}),
		).rejects.toBe(rateLimit);

		expect(delegate).toHaveBeenCalledTimes(1);
	});
});
