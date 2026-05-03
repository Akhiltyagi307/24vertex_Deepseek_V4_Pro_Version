import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// So `pnpm run test:e2e` picks up PLAYWRIGHT_* from .env.local without a wrapper command.
// Does not override variables already set (e.g. CI secrets).
loadEnv({ path: resolve(process.cwd(), ".env.local") });

/** Avoid Node preferring ::1 for "localhost" while the dev server listens on IPv4 only. */
function normalizeBaseURL(url: string): string {
	try {
		const u = new URL(url);
		if (u.hostname === "localhost") u.hostname = "127.0.0.1";
		return u.origin + (u.pathname === "/" ? "" : u.pathname);
	} catch {
		return url;
	}
}

const baseURL = normalizeBaseURL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001");

const isLoopback =
	baseURL.includes("127.0.0.1") || baseURL.includes("localhost") || baseURL.includes("0.0.0.0");

/**
 * Opt-in: `PLAYWRIGHT_START_WEBSERVER=1` runs `pnpm run dev` before tests (loopback base URL only).
 * Default is off so you run the app yourself (avoids duplicate servers and long waits if DB is slow).
 */
const webServer =
	process.env.PLAYWRIGHT_START_WEBSERVER === "1" && !process.env.CI && isLoopback ?
		{
			command: "pnpm run dev",
			url: baseURL,
			reuseExistingServer: true,
			timeout: 180_000,
		}
	:	undefined;

export default defineConfig({
	testDir: "tests/e2e",
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	...(webServer ? { webServer } : {}),
	use: {
		baseURL,
		trace: "on-first-retry",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
