import { afterEach, describe, expect, it, vi } from "vitest";

import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("assertCronRequestAuthorized", () => {
	it("allows localhost development requests without a cron secret", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("VERCEL_ENV", undefined);
		vi.stubEnv("CRON_SECRET", undefined);

		const result = assertCronRequestAuthorized(new Request("http://localhost:3001/api/internal/practice/run-jobs"));
		expect(result).toBeNull();
	});

	it("denies non-local requests when the cron secret is missing", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("VERCEL_ENV", "preview");
		vi.stubEnv("CRON_SECRET", undefined);

		const result = assertCronRequestAuthorized(new Request("https://preview.eduai.app/api/internal/practice/run-jobs"));
		expect(result?.status).toBe(401);
		await expect(result?.json()).resolves.toEqual({ ok: false, message: "Unauthorized." });
	});

	it("requires a matching bearer token when a cron secret is configured", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("CRON_SECRET", "secret-token");

		const ok = assertCronRequestAuthorized(
			new Request("https://eduai.app/api/internal/practice/run-jobs", {
				headers: { authorization: "Bearer secret-token" },
			}),
		);
		const denied = assertCronRequestAuthorized(
			new Request("https://eduai.app/api/internal/practice/run-jobs", {
				headers: { authorization: "Bearer wrong-token" },
			}),
		);

		expect(ok).toBeNull();
		expect(denied?.status).toBe(401);
	});
});
