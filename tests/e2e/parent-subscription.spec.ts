/**
 * Parent subscription page E2E. Audit D30 — read-only smoke (renders without
 * console errors, surface key UI primitives). Razorpay test-mode payment
 * flow is NOT exercised here; that requires sandbox API keys + UPI sim
 * which are beyond CI scope.
 *
 * Skips when PLAYWRIGHT_PARENT_EMAIL is unset OR when test parent has no
 * active student selected (subscription page redirects to /parent/select-student
 * in that case).
 */
import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

const PARENT_CRED_HINT =
	"Set PLAYWRIGHT_PARENT_EMAIL + PLAYWRIGHT_PARENT_PASSWORD in .env.local to run parent E2E.";

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

test.beforeEach(async () => {
	test.skip(!process.env.PLAYWRIGHT_PARENT_EMAIL?.trim(), PARENT_CRED_HINT);
});

test.describe("Parent subscription", () => {
	test("loads without console errors when an active student is selected", async ({ page }) => {
		const { errors } = attachConsoleCollector(page);
		await page.goto("/parent/subscription", { waitUntil: "domcontentloaded" });
		const path = new URL(page.url()).pathname;

		// If no active student, the page redirects to /parent/select-student.
		// Skip rather than fail — the test parent may not have one selected.
		test.skip(
			path !== "/parent/subscription",
			`subscription page bounced to ${path} — selection required`,
		);

		// Wait for hydration of the plan section.
		await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
		expect(errors, `console errors: ${errors.join("\n")}`).toHaveLength(0);
	});

	test("shows a plan & billing heading and a refund-policy link", async ({ page }) => {
		await page.goto("/parent/subscription", { waitUntil: "domcontentloaded" });
		test.skip(
			new URL(page.url()).pathname !== "/parent/subscription",
			"subscription page not reachable from this account",
		);
		await expect(page.getByRole("heading", { name: /plan\s*&?\s*billing/i }).first()).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByRole("link", { name: /refund/i }).first()).toBeVisible();
	});
});
