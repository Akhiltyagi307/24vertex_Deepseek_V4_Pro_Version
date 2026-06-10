import { afterEach, describe, expect, it, vi } from "vitest";

import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("assertCronRequestAuthorized", () => {
	it("allows localhost development requests when the explicit dev bypass flag is set", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("VERCEL_ENV", undefined);
		vi.stubEnv("CRON_SECRET", undefined);
		vi.stubEnv("ALLOW_UNAUTHENTICATED_CRON_DEV", "1");

		const result = assertCronRequestAuthorized(new Request("http://localhost:3001/api/internal/practice/run-jobs"));
		expect(result).toBeNull();
	});

	it("denies localhost development requests when the dev bypass flag is unset (L5)", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("VERCEL_ENV", undefined);
		vi.stubEnv("CRON_SECRET", undefined);
		vi.stubEnv("ALLOW_UNAUTHENTICATED_CRON_DEV", undefined);

		const result = assertCronRequestAuthorized(new Request("http://localhost:3001/api/internal/practice/run-jobs"));
		expect(result?.status).toBe(401);
	});

	it("denies non-local Vercel requests when the cron secret is missing", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("VERCEL_ENV", "preview");
		vi.stubEnv("VERCEL", "1");
		vi.stubEnv("CRON_SECRET", undefined);

		const result = assertCronRequestAuthorized(new Request("https://preview.24vertex.app/api/internal/practice/run-jobs"));
		expect(result?.status).toBe(401);
		await expect(result?.json()).resolves.toEqual({ ok: false, message: "Unauthorized." });
	});

	it("denies non-loopback hosts when the cron secret is missing (e.g. LAN dev URL)", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("CRON_SECRET", undefined);
		vi.stubEnv("VERCEL", undefined);

		const result = assertCronRequestAuthorized(new Request("http://10.0.0.2:3001/api/internal/practice/run-jobs"));
		expect(result?.status).toBe(401);
	});

	it("requires a matching bearer token when a cron secret is configured", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("CRON_SECRET", "secret-token");

		const ok = assertCronRequestAuthorized(
			new Request("https://24vertex.app/api/internal/practice/run-jobs", {
				headers: { authorization: "Bearer secret-token" },
			}),
		);
		const denied = assertCronRequestAuthorized(
			new Request("https://24vertex.app/api/internal/practice/run-jobs", {
				headers: { authorization: "Bearer wrong-token" },
			}),
		);

		expect(ok).toBeNull();
		expect(denied?.status).toBe(401);
	});
});
