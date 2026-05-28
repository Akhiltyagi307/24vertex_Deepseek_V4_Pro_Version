import { APICallError } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	formatProviderErrorForLog,
	isProviderFallbackEnabled,
	isRetryableProviderError,
	shouldAttemptProviderFallback,
} from "../provider-fallback";
import type { ResolvedAiModel } from "../model-router";

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

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("isProviderFallbackEnabled", () => {
	it("is enabled by default", () => {
		vi.stubEnv("AI_PROVIDER_FALLBACK_ENABLED", undefined);
		expect(isProviderFallbackEnabled()).toBe(true);
	});

	it("is disabled when env is false", () => {
		vi.stubEnv("AI_PROVIDER_FALLBACK_ENABLED", "false");
		expect(isProviderFallbackEnabled()).toBe(false);
	});
});

describe("isRetryableProviderError", () => {
	it("treats 429/503/504 APICallError as retryable", () => {
		for (const code of [429, 503, 504] as const) {
			expect(
				isRetryableProviderError(
					new APICallError({
						message: "rate limited",
						url: "https://api.deepseek.com",
						requestBodyValues: {},
						statusCode: code,
						responseHeaders: {},
						responseBody: "",
						isRetryable: true,
					}),
				),
			).toBe(true);
		}
	});

	it("does not treat 401 as retryable", () => {
		expect(
			isRetryableProviderError(
				new APICallError({
					message: "unauthorized",
					url: "https://api.deepseek.com",
					requestBodyValues: {},
					statusCode: 401,
					responseHeaders: {},
					responseBody: "",
					isRetryable: false,
				}),
			),
		).toBe(false);
	});

	it("matches overload messages on Error", () => {
		expect(isRetryableProviderError(new Error("Service is rate limited"))).toBe(true);
		expect(isRetryableProviderError(new Error("Service is rate-limiting requests"))).toBe(true);
	});

	it("does not match deepseek_structured_failure", () => {
		const err = new Error("schema failed");
		(err as { code?: string }).code = "deepseek_structured_failure";
		expect(isRetryableProviderError(err)).toBe(false);
	});
});

describe("formatProviderErrorForLog", () => {
	it("includes status code for APICallError", () => {
		const msg = formatProviderErrorForLog(
			new APICallError({
				message: "too many requests",
				url: "https://api.deepseek.com",
				requestBodyValues: {},
				statusCode: 429,
				responseHeaders: {},
				responseBody: "",
				isRetryable: true,
			}),
		);
		expect(msg).toContain("429");
	});
});

describe("shouldAttemptProviderFallback", () => {
	it("returns false for openai primary", () => {
		vi.stubEnv("OPENAI_API_KEY", "sk-test");
		vi.stubEnv("OPENAI_CHAT_MODEL_FALLBACK", "gpt-5.4-mini");
		expect(
			shouldAttemptProviderFallback({
				primary: openaiResolved,
				error: new Error("rate limit"),
			}),
		).toBe(false);
	});

	it("returns false when fallback disabled", () => {
		vi.stubEnv("AI_PROVIDER_FALLBACK_ENABLED", "false");
		vi.stubEnv("OPENAI_API_KEY", "sk-test");
		vi.stubEnv("OPENAI_CHAT_MODEL_FALLBACK", "gpt-5.4-mini");
		expect(
			shouldAttemptProviderFallback({
				primary: deepseekResolved,
				error: new Error("rate limit"),
			}),
		).toBe(false);
	});

	it("returns true for deepseek 429 when fallback configured", () => {
		vi.stubEnv("OPENAI_API_KEY", "sk-test");
		vi.stubEnv("OPENAI_CHAT_MODEL_FALLBACK", "gpt-5.4-mini");
		expect(
			shouldAttemptProviderFallback({
				primary: deepseekResolved,
				error: new APICallError({
					message: "429",
					url: "https://api.deepseek.com",
					requestBodyValues: {},
					statusCode: 429,
					responseHeaders: {},
					responseBody: "",
					isRetryable: true,
				}),
			}),
		).toBe(true);
	});
});
