/**
 * Playwright "setup project" — runs once before authenticated tests, signs in,
 * and saves the resulting cookies + localStorage to `playwright/.auth/user.json`.
 * Subsequent test projects load that file via `storageState` config.
 */

import { test as setup } from "@playwright/test";
import path from "node:path";

function playwrightUserEmail(): string {
	return (
		process.env.PLAYWRIGHT_USER_EMAIL?.trim() ||
		process.env["playwright_user_email"]?.trim() ||
		""
	);
}

function playwrightUserPassword(): string {
	return (
		process.env.PLAYWRIGHT_USER_PASSWORD?.trim() ||
		process.env["playwright_user_password"]?.trim() ||
		""
	);
}

export const STORAGE_STATE_PATH = path.join(__dirname, "../../playwright/.auth/user.json");

setup("authenticate", async ({ page }) => {
	const USER_EMAIL = playwrightUserEmail();
	const USER_PASSWORD = playwrightUserPassword();
	setup.skip(
		!USER_EMAIL || !USER_PASSWORD,
		"Set PLAYWRIGHT_USER_EMAIL and PLAYWRIGHT_USER_PASSWORD (or playwright_user_email / playwright_user_password) in .env.local for student E2E.",
	);

	await page.goto("/login");
	await page.getByLabel(/email/i).first().fill(USER_EMAIL);
	await page.getByLabel(/password/i).first().fill(USER_PASSWORD);

	// `signInWithPassword` + role routing run inside the server action — the
	// Supabase Auth call is no longer observable from the browser. Wait for the
	// navigation off /login as proof that credentials were accepted; if they were
	// not, the page stays on /login and `waitForURL` times out (test fails).
	await page.getByRole("button", { name: /sign\s*in|log\s*in/i }).first().click();
	await page.waitForURL((url) => !/\/login/.test(url.pathname), { timeout: 15_000 });

	// Persist storage state so subsequent test projects can load it directly.
	await page.context().storageState({ path: STORAGE_STATE_PATH });
});
