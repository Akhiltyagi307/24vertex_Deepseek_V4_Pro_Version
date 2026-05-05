/**
 * Parent storage-state setup. Mirrors `auth.setup.ts` for student, but signs
 * in a parent user and writes a separate JSON so parent-portal tests can use
 * `storageState: PARENT_STORAGE_STATE_PATH` without colliding with the
 * student session.
 *
 * Skips cleanly when PLAYWRIGHT_PARENT_EMAIL/PASSWORD are unset — local devs
 * who don't have a parent test account in their Supabase project still get
 * the rest of the suite passing.
 */

import { test as setup, expect } from "@playwright/test";
import path from "node:path";

function envValue(...names: string[]): string {
	for (const n of names) {
		const v = process.env[n]?.trim();
		if (v) return v;
	}
	return "";
}

function parentEmail(): string {
	return envValue("PLAYWRIGHT_PARENT_EMAIL", "playwright_parent_email");
}

function parentPassword(): string {
	return envValue("PLAYWRIGHT_PARENT_PASSWORD", "playwright_parent_password");
}

export const PARENT_STORAGE_STATE_PATH = path.join(__dirname, "../../playwright/.auth/parent.json");

setup("authenticate parent", async ({ page }) => {
	const email = parentEmail();
	const password = parentPassword();
	setup.skip(
		!email || !password,
		"Set PLAYWRIGHT_PARENT_EMAIL and PLAYWRIGHT_PARENT_PASSWORD to run parent-portal E2E.",
	);

	await page.goto("/login");
	await page.getByLabel(/email/i).first().fill(email);
	await page.getByLabel(/password/i).first().fill(password);

	const [authRes] = await Promise.all([
		page.waitForResponse(
			(r) => /\/auth\/v1\/token/.test(r.url()) && r.request().method() === "POST",
			{ timeout: 15_000 },
		),
		page.getByRole("button", { name: /sign\s*in|log\s*in/i }).first().click(),
	]);
	expect(authRes.status(), "Supabase Auth must accept these credentials").toBe(200);

	// Parent users are routed to /parent/select-student (no linked-children
	// shortcut) or /parent/dashboard (when one child is already selected).
	await page.waitForURL((url) => /\/parent\//.test(url.pathname), { timeout: 15_000 });

	await page.context().storageState({ path: PARENT_STORAGE_STATE_PATH });
});
