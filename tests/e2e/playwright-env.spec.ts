import { expect, test } from "@playwright/test";

/** Loose UUID check (matches what admin E2E expects for a Supabase-style id). */
const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mustBeSet(name: string, value: string | undefined): string {
	expect(value, `${name} must be set in .env.local (or exported) for admin E2E`).toBeTruthy();
	const trimmed = value!.trim();
	expect(trimmed.length, `${name} must not be only whitespace`).toBeGreaterThan(0);
	return trimmed;
}

test.describe("Playwright env from .env.local", () => {
	test("PLAYWRIGHT_BASE_URL is valid when set", () => {
		const raw = process.env.PLAYWRIGHT_BASE_URL?.trim();
		if (!raw) return;
		expect(() => new URL(raw), "PLAYWRIGHT_BASE_URL must be a valid URL").not.toThrow();
	});

	test("required admin E2E secrets are present and shaped correctly", () => {
		test.skip(
			!process.env.PLAYWRIGHT_ADMIN_EMAIL?.trim() ||
				!process.env.PLAYWRIGHT_ADMIN_PASSWORD?.trim() ||
				!process.env.PLAYWRIGHT_E2E_TARGET_USER_ID?.trim(),
			"Admin E2E not configured — set PLAYWRIGHT_ADMIN_EMAIL, PLAYWRIGHT_ADMIN_PASSWORD, PLAYWRIGHT_E2E_TARGET_USER_ID to validate",
		);

		const email = mustBeSet("PLAYWRIGHT_ADMIN_EMAIL", process.env.PLAYWRIGHT_ADMIN_EMAIL);
		expect(email, "PLAYWRIGHT_ADMIN_EMAIL should look like an email").toMatch(/@/);

		mustBeSet("PLAYWRIGHT_ADMIN_PASSWORD", process.env.PLAYWRIGHT_ADMIN_PASSWORD);

		const userId = mustBeSet(
			"PLAYWRIGHT_E2E_TARGET_USER_ID",
			process.env.PLAYWRIGHT_E2E_TARGET_USER_ID,
		);
		expect(userId, "PLAYWRIGHT_E2E_TARGET_USER_ID should be a UUID").toMatch(UUID_RE);
	});

	test("student E2E credentials are shaped correctly when set", () => {
		const email =
			process.env.PLAYWRIGHT_USER_EMAIL?.trim() ||
			process.env["playwright_user_email"]?.trim();
		if (!email) return;

		expect(email, "student Playwright email should look like an email").toMatch(/@/);
		const password =
			process.env.PLAYWRIGHT_USER_PASSWORD?.trim() ||
			process.env["playwright_user_password"]?.trim();
		expect(password, "password must be set when student email is set").toBeTruthy();
		expect(password!.trim().length, "password must not be only whitespace").toBeGreaterThan(0);
	});

	test("optional PLAYWRIGHT_ADMIN_TOTP is 6 digits when set", () => {
		const totp = process.env.PLAYWRIGHT_ADMIN_TOTP?.trim();
		if (!totp) return;
		expect(totp, "PLAYWRIGHT_ADMIN_TOTP must be exactly 6 digits when set").toMatch(/^\d{6}$/);
	});

	test("optional PLAYWRIGHT_PANIC_TOKEN is non-empty when set", () => {
		const token = process.env.PLAYWRIGHT_PANIC_TOKEN?.trim();
		if (!token) return;
		expect(token.length, "PLAYWRIGHT_PANIC_TOKEN must not be empty when set").toBeGreaterThan(0);
	});
});
