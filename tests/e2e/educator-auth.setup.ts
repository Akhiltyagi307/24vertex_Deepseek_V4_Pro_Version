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

	// `signInWithPassword` + role routing run inside the server action, so the
	// Supabase Auth call is no longer observable from the browser (see
	// auth.setup.ts). Wait for the navigation to the teacher portal as proof
	// the credentials were accepted: a wrong password keeps us on /login (this
	// times out), while a verified teacher lands on /teacher/* and an unverified
	// one on /teacher/pending (asserted below).
	await page.getByRole("button", { name: /sign\s*in|log\s*in/i }).first().click();
	await page.waitForURL((url) => /\/teacher\//.test(url.pathname), { timeout: 30_000 });
	expect(
		page.url(),
		"Teacher test account must be admin-verified (is_verified=true) before the suite can sign in.",
	).not.toContain("/teacher/pending");

	await page.context().storageState({ path: TEACHER_STORAGE_STATE_PATH });
});
