/**
 * Educator (teacher) storage-state setup. Mirrors `parent-auth.setup.ts` but
 * signs in a verified teacher user and writes a separate JSON so teacher-portal
 * tests can use `storageState: TEACHER_STORAGE_STATE_PATH` without colliding
 * with the student or parent session.
 *
 * Skips cleanly when PLAYWRIGHT_TEACHER_EMAIL / PLAYWRIGHT_TEACHER_PASSWORD
 * are unset — local devs and CI environments without a verified teacher test
 * account in their Supabase project still get the rest of the suite passing.
 *
 * The credentialed teacher MUST be `is_verified = true` (admin-approved) for
 * the protected layout to let the suite past `/teacher/pending`.
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

function teacherEmail(): string {
	return envValue("PLAYWRIGHT_TEACHER_EMAIL", "playwright_teacher_email");
}

function teacherPassword(): string {
	return envValue("PLAYWRIGHT_TEACHER_PASSWORD", "playwright_teacher_password");
}

export const TEACHER_STORAGE_STATE_PATH = path.join(__dirname, "../../playwright/.auth/teacher.json");

setup("authenticate teacher", async ({ page }) => {
	const email = teacherEmail();
	const password = teacherPassword();
	setup.skip(
		!email || !password,
		"Set PLAYWRIGHT_TEACHER_EMAIL and PLAYWRIGHT_TEACHER_PASSWORD to run teacher-portal E2E.",
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

	// Verified teachers land on /teacher/dashboard; unverified land on /teacher/pending.
	// We require a verified account for the rest of the suite — fail loudly if the
	// teacher is still pending so the operator knows to approve them.
	await page.waitForURL((url) => /\/teacher\//.test(url.pathname), { timeout: 15_000 });
	expect(
		page.url(),
		"Teacher test account must be admin-verified (is_verified=true) before the suite can sign in.",
	).not.toContain("/teacher/pending");

	await page.context().storageState({ path: TEACHER_STORAGE_STATE_PATH });
});
