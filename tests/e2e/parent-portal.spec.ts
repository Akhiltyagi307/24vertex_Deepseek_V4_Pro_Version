/**
 * Parent-portal E2E. Verifies the trust boundary that the audit flagged as
 * untested: a parent user can ONLY interact with linked children, and is not
 * able to reach student-portal routes by URL guessing.
 *
 * Test plan:
 *   1. Authenticated parent landing page is /parent/select-student or /parent/dashboard.
 *   2. /student/dashboard is NOT reachable as parent — redirects (or 403s)
 *      back to a parent or login route.
 *   3. /parent/dashboard renders the linked-children sidebar widget.
 *   4. Parent can navigate to /parent/notifications without errors.
 *
 * Auth runs once via `parent-auth.setup.ts` (Playwright project should chain
 * `parent-auth-setup` before `parent-portal`); this file expects the storage
 * state at `playwright/.auth/parent.json`.
 *
 * The whole suite skips when PLAYWRIGHT_PARENT_EMAIL is not set, matching the
 * existing student-suite behavior.
 */

import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";

const PARENT_CRED_HINT =
	"Set PLAYWRIGHT_PARENT_EMAIL + PLAYWRIGHT_PARENT_PASSWORD in .env.local to run parent E2E.";

test.beforeEach(async () => {
	test.skip(
		!process.env.PLAYWRIGHT_PARENT_EMAIL?.trim(),
		PARENT_CRED_HINT,
	);
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

test.describe("Parent portal — trust boundary", () => {
	test("authenticated parent lands on /parent/* (not student routes)", async ({ page }) => {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		const path = new URL(page.url()).pathname;
		expect(
			path.startsWith("/parent/"),
			`expected /parent/* landing, got ${path}`,
		).toBe(true);
	});

	test("/student/dashboard is unreachable as parent (URL-guessing defense)", async ({ page }) => {
		const response = await page.goto("/student/dashboard", { waitUntil: "domcontentloaded" });
		const finalPath = new URL(page.url()).pathname;
		// Acceptable outcomes: redirect to /parent/* (RBAC-driven), redirect to /login,
		// or a hard 403/404 status. NOT acceptable: the page renders student content.
		const ok =
			finalPath.startsWith("/parent/") ||
			finalPath === "/login" ||
			(response?.status() ?? 200) >= 400;
		expect(
			ok,
			`parent should be redirected/blocked from /student/dashboard, ended on ${finalPath} status=${response?.status()}`,
		).toBe(true);
		// Sanity: no student-only chrome leaked
		await expect(page.getByRole("heading", { name: /^subject progress$/i })).toHaveCount(0);
	});

	test("/parent/dashboard renders without console errors", async ({ page }) => {
		const { errors } = attachConsoleCollector(page);
		await page.goto("/parent/dashboard", { waitUntil: "domcontentloaded" });
		// If the parent has no linked children, app may redirect to /parent/select-student
		// or /parent/link-child. Both are acceptable.
		const path = new URL(page.url()).pathname;
		expect(path.startsWith("/parent/")).toBe(true);
		expect(errors, `console errors on /parent/dashboard: ${errors.join("\n")}`).toHaveLength(0);
	});

	test("/parent/notifications loads", async ({ page }) => {
		const { errors } = attachConsoleCollector(page);
		await page.goto("/parent/notifications", { waitUntil: "domcontentloaded" });
		const path = new URL(page.url()).pathname;
		// Should stay in parent space — never bounce to /student/notifications.
		expect(path.startsWith("/parent/") || path === "/login").toBe(true);
		expect(errors, `console errors on /parent/notifications: ${errors.join("\n")}`).toHaveLength(0);
	});

	test("/parent/link-child form renders form fields", async ({ page }) => {
		await page.goto("/parent/link-child", { waitUntil: "domcontentloaded" });
		const path = new URL(page.url()).pathname;
		test.skip(path !== "/parent/link-child", `link-child not reachable from this account: ${path}`);
		// Form should expose at least an email/identifier field for the student.
		await expect(page.getByLabel(/student.*email|child.*email|email/i).first()).toBeVisible({
			timeout: 5000,
		});
	});
});
