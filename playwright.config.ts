import fs from "node:fs";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Mirrors `vitest.config.ts` — Playwright doesn't auto-load .env files, so
// without this `auth.setup.ts` (and any spec that depends on credentials)
// silently skip when run with a bare `playwright test`.
const envLocal = path.resolve(__dirname, ".env.local");
const envFallback = path.resolve(__dirname, ".env");
loadEnv({ path: fs.existsSync(envLocal) ? envLocal : envFallback });

/**
 * Playwright config.
 *
 * Until now the project ran tests against Playwright's built-in defaults,
 * which meant `auth.setup.ts` and `parent-auth.setup.ts` ran as ordinary
 * tests and downstream specs picked up storage state by importing the
 * file path constants directly. That worked for a single-role suite but
 * couldn't express "always run parent auth before parent-portal specs"
 * — exactly the kind of dependency the new parent suite needs.
 *
 * Project graph:
 *   - `auth-setup`        : signs in a student, writes student.json
 *   - `parent-auth-setup` : signs in a parent, writes parent.json
 *   - `student`           : depends on auth-setup, loads student.json
 *   - `parent`            : depends on parent-auth-setup, loads parent.json
 *   - `unauth`            : runs the smoke / playwright-env specs that
 *                            don't need any session
 *
 * Each `*-auth-setup` test self-skips when its credential env vars are
 * unset (see auth.setup.ts / parent-auth.setup.ts). When skipped, the
 * dependent project's storageState file may not exist; Playwright then
 * skips those specs too, which is what we want for forks without seed
 * credentials.
 */

const STUDENT_STORAGE_STATE = path.join(__dirname, "playwright/.auth/user.json");
const PARENT_STORAGE_STATE = path.join(__dirname, "playwright/.auth/parent.json");

const baseURL =
	process.env.PLAYWRIGHT_BASE_URL?.trim() ||
	process.env.NEXT_PUBLIC_APP_URL?.trim() ||
	"http://127.0.0.1:3001";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: false,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",

	use: {
		baseURL,
		trace: "on-first-retry",
		// We always test against the same browser engine — there's no
		// cross-browser concern in this suite (admin + role flows that
		// don't use vendor-specific APIs).
		...devices["Desktop Chrome"],
	},

	webServer:
		process.env.PLAYWRIGHT_START_WEBSERVER === "1" ?
			{
				command: "pnpm run dev",
				url: baseURL,
				reuseExistingServer: !process.env.CI,
				timeout: 120_000,
			}
		:	undefined,

	projects: [
		{
			name: "auth-setup",
			// Match auth.setup.ts but NOT parent-auth.setup.ts — the parent
			// variant is its own project below.
			testMatch: /(?<!parent-)auth\.setup\.ts$/,
		},
		{
			name: "parent-auth-setup",
			testMatch: /parent-auth\.setup\.ts$/,
		},
		// Specs that don't need a pre-loaded session: smoke, env probe, and
		// admin-panel (which signs in fresh via `loginAsAdmin` and would
		// break if a student/parent storageState were preloaded).
		{
			name: "unauth",
			testMatch:
				/(smoke|playwright-env|admin-panel|security-headers|a11y-axe|visual-snapshots)\.spec\.ts$/,
		},
		{
			name: "student",
			testMatch: /(post-login|notifications|practice-generate|practice-full-subjects)\.spec\.ts$/,
			dependencies: ["auth-setup"],
			use: { storageState: STUDENT_STORAGE_STATE },
		},
		{
			name: "parent",
			testMatch: /parent-portal\.spec\.ts$/,
			dependencies: ["parent-auth-setup"],
			use: { storageState: PARENT_STORAGE_STATE },
		},
	],
});
