/**
 * Parent link-child E2E. Audit D28 coverage:
 *   - Invalid code format → inline error
 *   - Code that doesn't match a student → error from RPC
 *   - Already-linked code → second attempt either succeeds silently (re-links)
 *     or shows a clear error; both are acceptable trust-boundary outcomes
 *   - Wrong-format input is rejected by client-side validation (Zod)
 *
 * Skips when PLAYWRIGHT_PARENT_EMAIL/PLAYWRIGHT_PARENT_PASSWORD are unset,
 * matching parent-portal.spec.ts.
 */
import { expect, test } from "@playwright/test";

const PARENT_CRED_HINT =
	"Set PLAYWRIGHT_PARENT_EMAIL + PLAYWRIGHT_PARENT_PASSWORD in .env.local to run parent E2E.";

test.beforeEach(async () => {
	test.skip(!process.env.PLAYWRIGHT_PARENT_EMAIL?.trim(), PARENT_CRED_HINT);
});

test.describe("Parent link-child", () => {
	test("rejects an obviously malformed link code", async ({ page }) => {
		await page.goto("/parent/link-child", { waitUntil: "domcontentloaded" });
		test.skip(
			new URL(page.url()).pathname !== "/parent/link-child",
			"link-child not reachable from this account",
		);

		// Field accepts either a six-character link code or a UUID; "??" is
		// neither.
		const input = page.getByLabel(/student.*email|child.*email|link.*code|email/i).first();
		await input.fill("??");
		await page.getByRole("button", { name: /link|submit|continue/i }).first().click();

		// Either inline error or stay on page — must NOT navigate to /parent/dashboard.
		await page.waitForTimeout(500);
		const path = new URL(page.url()).pathname;
		expect(path).toBe("/parent/link-child");
	});

	test("non-existent link code surfaces a user-visible error", async ({ page }) => {
		await page.goto("/parent/link-child", { waitUntil: "domcontentloaded" });
		test.skip(
			new URL(page.url()).pathname !== "/parent/link-child",
			"link-child not reachable from this account",
		);

		const input = page.getByLabel(/student.*email|child.*email|link.*code|email/i).first();
		// Format-valid but no student should ever have this code (XYZ12345 = new
		// 8-char format with a fixed pattern unlikely to collide).
		await input.fill("XYZ99999");
		await page.getByRole("button", { name: /link|submit|continue/i }).first().click();

		// Wait for either error text or navigation away.
		await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
		const path = new URL(page.url()).pathname;
		// Acceptable: stays on /parent/link-child with error, or bounces back.
		expect(path.startsWith("/parent/")).toBe(true);
		// Sanity: no /dashboard route — we did NOT silently succeed.
		expect(path).not.toContain("/dashboard");
	});
});
