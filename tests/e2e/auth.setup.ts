/**
 * Playwright "setup project" — runs once before authenticated tests, signs in,
 * and saves the resulting cookies + localStorage to `playwright/.auth/user.json`.
 * Subsequent test projects load that file via `storageState` config.
 */

import { test as setup, expect } from "@playwright/test";
import path from "node:path";

const USER_EMAIL = process.env.PLAYWRIGHT_USER_EMAIL ?? "";
const USER_PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD ?? "";

export const STORAGE_STATE_PATH = path.join(__dirname, "../../playwright/.auth/user.json");

setup("authenticate", async ({ page }) => {
	if (!USER_EMAIL || !USER_PASSWORD) {
		throw new Error(
			"PLAYWRIGHT_USER_EMAIL / PLAYWRIGHT_USER_PASSWORD must be set in .env.local for the auth setup to run.",
		);
	}

	await page.goto("/login");
	await page.getByLabel(/email/i).first().fill(USER_EMAIL);
	await page.getByLabel(/password/i).first().fill(USER_PASSWORD);

	const [authRes] = await Promise.all([
		page.waitForResponse(
			(r) => /\/auth\/v1\/token/.test(r.url()) && r.request().method() === "POST",
			{ timeout: 15_000 },
		),
		page.getByRole("button", { name: /sign\s*in|log\s*in/i }).first().click(),
	]);
	expect(authRes.status(), "Supabase Auth must accept these credentials").toBe(200);

	// `signInWithPassword` triggers `window.location.assign("/")`. From there,
	// `app/page.tsx` redirects to the role-resolved post-auth path.
	await page.waitForURL((url) => !/\/login/.test(url.pathname), { timeout: 15_000 });

	// Persist storage state so subsequent test projects can load it directly.
	await page.context().storageState({ path: STORAGE_STATE_PATH });
});
