import { afterEach, describe, expect, it, vi } from "vitest";

import { getAppUrl, getOpenAIChatModel } from "@/lib/env";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("getAppUrl", () => {
	it("falls back to localhost during development", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("VERCEL_ENV", undefined);
		vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);

		expect(getAppUrl()).toBe("http://localhost:3001");
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
