/**
 * Teacher-portal E2E. Covers the audit's D27 surface: dashboard load,
 * performance band strip, settings tab navigation, student-performance and
 * topic-performance directories, and the role/auth boundary (a teacher
 * cannot reach the student portal by URL guessing).
 *
 * Auth runs once via `educator-auth.setup.ts` (Playwright project chains
 * `teacher-auth-setup` before `teacher`); this file expects the storage
 * state at `playwright/.auth/teacher.json` and a verified teacher account.
 *
 * Skips cleanly when PLAYWRIGHT_TEACHER_EMAIL is not set, matching the
 * existing parent suite posture.
 */

import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";

const TEACHER_CRED_HINT =
	"Set PLAYWRIGHT_TEACHER_EMAIL + PLAYWRIGHT_TEACHER_PASSWORD in .env.local to run teacher E2E.";

test.beforeEach(async () => {
	test.skip(!process.env.PLAYWRIGHT_TEACHER_EMAIL?.trim(), TEACHER_CRED_HINT);
});

const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
	/Failed to load resource.*sentry/i,
	/sentry.*not configured/i,
	/Download the React DevTools/i,
	/\[Fast Refresh\]/i,
	/Content Security Policy directive/i,
	/Failed to load resource:.*\b404\b/i,
];

function attachConsoleCollector(page: Page): { errors: string[] } {
	const errors: string[] = [];
	page.on("console", (msg: ConsoleMessage) => {
		const text = msg.text();
		if (IGNORED_CONSOLE_PATTERNS.some((p) => p.test(text))) return;
		if (msg.type() === "error") errors.push(text);
	});
	page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
	return { errors };
}

test.describe("Teacher portal", () => {
	test("authenticated teacher lands on /teacher/* (not pending, not student)", async ({ page }) => {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		const path = new URL(page.url()).pathname;
		expect(path.startsWith("/teacher/"), `expected /teacher/* landing, got ${path}`).toBe(true);
		expect(path).not.toBe("/teacher/pending");
	});

	test("/teacher/dashboard renders the performance band section", async ({ page }) => {
		const { errors } = attachConsoleCollector(page);
		await page.goto("/teacher/dashboard", { waitUntil: "domcontentloaded" });
		const path = new URL(page.url()).pathname;
		expect(path.startsWith("/teacher/")).toBe(true);
		// The performance band strip exposes an aria-label we can match on,
		// independent of whether the teacher has students in scope yet.
		await expect(
			page.getByRole("region", { name: /student distribution by performance band/i }).first(),
		).toBeVisible({ timeout: 10_000 });
		expect(errors, `console errors on /teacher/dashboard: ${errors.join("\n")}`).toHaveLength(0);
	});

	test("/teacher/assignments loads without errors", async ({ page }) => {
		const { errors } = attachConsoleCollector(page);
		await page.goto("/teacher/assignments", { waitUntil: "domcontentloaded" });
		const path = new URL(page.url()).pathname;
		expect(path.startsWith("/teacher/")).toBe(true);
		await expect(page).toHaveTitle(/assignments/i, { timeout: 5000 });
		expect(errors, `console errors on /teacher/assignments: ${errors.join("\n")}`).toHaveLength(0);
	});

	test("/teacher/settings exposes Profile/Login email/Password tabs", async ({ page }) => {
		await page.goto("/teacher/settings", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("tab", { name: /^profile$/i })).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole("tab", { name: /login email/i })).toBeVisible();
		await expect(page.getByRole("tab", { name: /^password$/i })).toBeVisible();
		// Profile tab is the default — display-name field should be present.
		await expect(page.getByLabel(/display name/i)).toBeVisible();
	});

	test("/teacher/student-performance renders the directory", async ({ page }) => {
		const { errors } = attachConsoleCollector(page);
		await page.goto("/teacher/student-performance", { waitUntil: "domcontentloaded" });
		const path = new URL(page.url()).pathname;
		expect(path.startsWith("/teacher/")).toBe(true);
		await expect(page).toHaveTitle(/student performance/i, { timeout: 5000 });
		expect(errors, `console errors on /teacher/student-performance: ${errors.join("\n")}`).toHaveLength(0);
	});

	test("/teacher/topic-performance renders the directory", async ({ page }) => {
		const { errors } = attachConsoleCollector(page);
		await page.goto("/teacher/topic-performance", { waitUntil: "domcontentloaded" });
		const path = new URL(page.url()).pathname;
		expect(path.startsWith("/teacher/")).toBe(true);
		await expect(page).toHaveTitle(/topic performance/i, { timeout: 5000 });
		expect(errors, `console errors on /teacher/topic-performance: ${errors.join("\n")}`).toHaveLength(0);
	});

	test("404 inside /teacher uses the portal-aware not-found", async ({ page }) => {
		const response = await page.goto("/teacher/this-does-not-exist", { waitUntil: "domcontentloaded" });
		expect(response?.status()).toBe(404);
		// The portal-scoped not-found wraps the message with a "Back to dashboard" link.
		await expect(page.getByRole("link", { name: /back to dashboard/i })).toBeVisible({ timeout: 5000 });
	});

	test("/student/dashboard is unreachable as teacher (URL-guessing defense)", async ({ page }) => {
		const response = await page.goto("/student/dashboard", { waitUntil: "domcontentloaded" });
		const finalPath = new URL(page.url()).pathname;
		// Acceptable outcomes: redirect to /teacher/*, redirect to /login, or a hard 4xx.
		const ok =
			finalPath.startsWith("/teacher/") ||
			finalPath === "/login" ||
			(response?.status() ?? 200) >= 400;
		expect(
			ok,
			`teacher should be redirected/blocked from /student/dashboard, ended on ${finalPath} status=${response?.status()}`,
		).toBe(true);
	});
});
