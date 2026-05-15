import { afterEach, describe, expect, it, vi } from "vitest";

import {
	getAppUrl,
	getOpenAIDoubtChatModel,
	getOpenAIChatModel,
	getOpenAIPracticeChatModel,
	getOpenAIPracticeChatModelFallback,
} from "@/lib/env";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("getAppUrl", () => {
	it("falls back to 127.0.0.1 during development (matches next-dev bind)", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("VERCEL_ENV", undefined);
		vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);
		vi.stubEnv("PORT", undefined);

		expect(getAppUrl()).toBe("http://127.0.0.1:3001");
	});

	it("uses PORT for dev fallback when set", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("VERCEL_ENV", undefined);
		vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);
		vi.stubEnv("PORT", "3005");

		expect(getAppUrl()).toBe("http://127.0.0.1:3005");
	});

	it("normalizes a configured URL", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://eduai.example.com/");

		expect(getAppUrl()).toBe("https://eduai.example.com");
	});

	it("throws in production when the app URL is missing", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("VERCEL_ENV", "production");
		vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);

		expect(() => getAppUrl()).toThrow("Missing NEXT_PUBLIC_APP_URL");
	});

	it("rejects localhost URLs in production", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("VERCEL_ENV", "production");
		vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001");

		expect(() => getAppUrl()).toThrow("NEXT_PUBLIC_APP_URL cannot point to localhost in production.");
	});
});

describe("getOpenAIChatModel", () => {
	it("uses the local fallback outside production", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("VERCEL_ENV", undefined);
		vi.stubEnv("OPENAI_CHAT_MODEL", undefined);

		expect(getOpenAIChatModel()).toBe("gpt-5.4-mini");
	});

	it("throws in production when the model is missing", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("VERCEL_ENV", "production");
		vi.stubEnv("OPENAI_CHAT_MODEL", undefined);

		expect(() => getOpenAIChatModel()).toThrow("Missing OPENAI_CHAT_MODEL");
	});
});

describe("getOpenAIDoubtChatModel", () => {
	it("uses OPENAI_DOUBT_CHAT_MODEL when set", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("OPENAI_DOUBT_CHAT_MODEL", "gpt-4o");
		vi.stubEnv("OPENAI_CHAT_MODEL", "gpt-5.4-mini");

		expect(getOpenAIDoubtChatModel()).toBe("gpt-4o");
	});

	it("falls back to getOpenAIChatModel when OPENAI_DOUBT_CHAT_MODEL is unset", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("OPENAI_DOUBT_CHAT_MODEL", undefined);
		vi.stubEnv("OPENAI_CHAT_MODEL", "gpt-custom");

		expect(getOpenAIDoubtChatModel()).toBe("gpt-custom");
	});

	it("falls back to the dev default chat model when neither doubt nor chat model env is set", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("VERCEL_ENV", undefined);
		vi.stubEnv("OPENAI_DOUBT_CHAT_MODEL", undefined);
		vi.stubEnv("OPENAI_CHAT_MODEL", undefined);

		expect(getOpenAIDoubtChatModel()).toBe("gpt-5.4-mini");
	});
});

describe("practice-specific model envs", () => {
	it("uses OPENAI_PRACTICE_CHAT_MODEL when set", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("OPENAI_CHAT_MODEL", "gpt-5.5");
		vi.stubEnv("OPENAI_PRACTICE_CHAT_MODEL", "gpt-5.4-mini");
		expect(getOpenAIPracticeChatModel()).toBe("gpt-5.4-mini");
	});

	it("falls back to OPENAI_CHAT_MODEL when OPENAI_PRACTICE_CHAT_MODEL is unset", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("OPENAI_CHAT_MODEL", "gpt-5.5");
		vi.stubEnv("OPENAI_PRACTICE_CHAT_MODEL", undefined);
		expect(getOpenAIPracticeChatModel()).toBe("gpt-5.5");
	});

	it("uses practice fallback env first, then generic fallback", () => {
		vi.stubEnv("OPENAI_PRACTICE_CHAT_MODEL_FALLBACK", "gpt-5.5");
		vi.stubEnv("OPENAI_CHAT_MODEL_FALLBACK", "gpt-5.4-mini");
		expect(getOpenAIPracticeChatModelFallback()).toBe("gpt-5.5");
		vi.stubEnv("OPENAI_PRACTICE_CHAT_MODEL_FALLBACK", undefined);
		expect(getOpenAIPracticeChatModelFallback()).toBe("gpt-5.4-mini");
	});
});
