import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock env getters so the router can resolve a model id without touching real
// API credentials. We do NOT mock `process.env.AI_PROVIDER_*` here because the
// router reads those directly via `process.env`, so we set them per test.
vi.mock("@/lib/env", () => ({
	getOpenAIChatModel: () => "gpt-test",
	getOpenAIDoubtChatModel: () => "gpt-5.4-mini-test",
	getOpenAIPracticeChatModel: () => "gpt-test",
	getDeepSeekDoubtChatModel: () => "deepseek-v4-flash-test",
	getDeepSeekPracticeChatModel: () => "deepseek-v4-pro-test",
	getDeepSeekBlueprintModel: () => "deepseek-v4-flash-test",
	getDeepSeekVisualEnrichmentModel: () => "deepseek-v4-flash-test",
	getDeepSeekValidationModel: () => "deepseek-v4-flash-test",
	getDeepSeekGradeSummaryModel: () => "deepseek-v4-flash-test",
	getDeepSeekGradingChatModel: () => "deepseek-v4-pro-test",
	getDeepSeekApiKey: () => "test-key",
	getDeepSeekBaseUrl: () => "https://api.deepseek.com",
	getDeepSeekReasoningEffort: () => "medium",
	getDeepSeekBlueprintThinking: () => "enabled",
	getDeepSeekVisualEnrichmentThinking: () => "enabled",
	getDeepSeekValidationThinking: () => "enabled",
	getDeepSeekGradeSummaryThinking: () => "enabled",
}));

vi.mock("@/lib/ai/openai-provider", () => ({
	getOpenAIProvider: () => ({ chat: (id: string) => ({ id }) }),
}));

vi.mock("@/lib/ai/deepseek-provider", () => ({
	getDeepSeekProvider: () => ({ chat: (id: string) => ({ id }) }),
	deepseekThinkingProviderOptions: () => ({
		deepseek: { thinking: { type: "enabled" }, reasoningEffort: "medium" },
	}),
	isThinkingActiveForFeature: () => true,
}));

import { resolveChatModel } from "@/lib/ai/model-router";

describe("resolveChatModel — doubt.chat provider selection", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		process.env.AI_PROVIDER_DOUBT_CHAT = "deepseek";
		process.env.AI_PROVIDER_DEFAULT = "deepseek";
	});

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	it("routes text-only turns to DeepSeek", () => {
		const r = resolveChatModel("doubt.chat");
		expect(r.provider).toBe("deepseek");
		expect(r.modelId).toBe("deepseek-v4-flash-test");
	});

	it("routes PDF-only turns to DeepSeek (no image attachment flag set)", () => {
		// PDFs do not set hasImageAttachment because the route handler extracts
		// PDF text upstream and only flags images.
		const r = resolveChatModel("doubt.chat", { hasImageAttachment: false });
		expect(r.provider).toBe("deepseek");
		expect(r.modelId).toBe("deepseek-v4-flash-test");
	});

	it("forces OpenAI when an image is attached, regardless of env provider", () => {
		const r = resolveChatModel("doubt.chat", { hasImageAttachment: true });
		expect(r.provider).toBe("openai");
		expect(r.modelId).toBe("gpt-5.4-mini-test");
	});

	it("returns to DeepSeek on the next turn when no image is attached", () => {
		// Simulate a two-turn sequence: turn 1 with image → openai;
		// turn 2 without attachments → back to deepseek.
		const turn1 = resolveChatModel("doubt.chat", { hasImageAttachment: true });
		const turn2 = resolveChatModel("doubt.chat", { hasImageAttachment: false });
		expect(turn1.provider).toBe("openai");
		expect(turn2.provider).toBe("deepseek");
	});

	it("uses the configured DeepSeek doubt-chat model (flash by default)", () => {
		const r = resolveChatModel("doubt.chat");
		// In production this is `deepseek-v4-flash`; here we mock it to a
		// recognisable test string but assert on the structure.
		expect(r.modelId).toContain("flash");
	});
});
