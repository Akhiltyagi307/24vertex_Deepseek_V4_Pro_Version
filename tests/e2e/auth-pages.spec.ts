import { test, expect } from "@playwright/test";

/**
 * Shape + flow coverage for the (auth) route group. These tests do not create
 * real Supabase accounts — they verify rendering, per-page metadata, client
 * validation gates, and the enumeration-safe forgot-password response shape.
 * Real signup creation requires test-mode email infra and lives in dedicated
 * fixtures (or is asserted indirectly via the auth-setup project).
 */

test.describe("(auth) page shells + metadata", () => {
	test("/login has the right title and shows the form", async ({ page }) => {
		await page.goto("/login");
		await expect(page).toHaveTitle(/Log in · EduAI/);
		await expect(page.getByLabel(/email/i).first()).toBeVisible();
		await expect(page.getByLabel(/password/i).first()).toBeVisible();
	});

	test("/login/educator has the educator-specific title", async ({ page }) => {
		await page.goto("/login/educator");
		await expect(page).toHaveTitle(/Educator log in · EduAI/);
	});

	test("/forgot-password renders with title + heading", async ({ page }) => {
		await page.goto("/forgot-password");
		await expect(page).toHaveTitle(/Reset password · EduAI/);
		await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible();
	});

	test("/signup/role-picker has the right title", async ({ page }) => {
		await page.goto("/signup/role-picker");
		await expect(page).toHaveTitle(/Choose how to sign up · EduAI/);
	});

	test("/signup/student renders with title + name field", async ({ page }) => {
		await page.goto("/signup/student");
		await expect(page).toHaveTitle(/Student sign up · EduAI/);
		await expect(page.getByLabel(/full name/i)).toBeVisible();
	});

	test("/signup/parent renders with title + link code field", async ({ page }) => {
		await page.goto("/signup/parent");
		await expect(page).toHaveTitle(/Parent sign up · EduAI/);
		await expect(page.getByLabel(/student link code/i)).toBeVisible();
	});

	test("/signup/teacher renders with title + mobile field", async ({ page }) => {
		await page.goto("/signup/teacher");
		await expect(page).toHaveTitle(/Teacher sign up · EduAI/);
		await expect(page.getByLabel(/mobile number/i)).toBeVisible();
	});

	// Note: Next.js renders the root `app/not-found.tsx` for unmatched URLs
	// regardless of route-group boundaries — `app/(auth)/not-found.tsx` only
	// fires on explicit `notFound()` calls inside (auth) pages, of which there
	// are currently none. The (auth)/not-found.tsx file is kept as a forward-
	// compatible boundary; no e2e assertion until an auth page calls notFound().
});

test.describe("Signup client validation gates", () => {
	test("student signup blocks step transition with empty fields", async ({ page }) => {
		await page.goto("/signup/student");
		await page.getByRole("button", { name: /^continue$/i }).click();
		await expect(page.getByText(/check this step/i)).toBeVisible();
	});

	test("student signup rejects mismatched passwords on step 1", async ({ page }) => {
		await page.goto("/signup/student");
		await page.getByLabel(/full name/i).fill("Test Student");
		// Unique email so we never collide with real test accounts even if a
		// stray signUp were ever to fire — but it won't, the test stops at the
		// step transition.
		await page.getByLabel(/^email$/i).fill(`shape-only-${Date.now()}@example.invalid`);
		await page.getByLabel(/^password$/i).fill("ValidPass123");
		await page.getByLabel(/confirm password/i).fill("DifferentPass456");
		await page.getByRole("button", { name: /^continue$/i }).click();
		await expect(page.getByText(/passwords do not match/i)).toBeVisible();
	});

	test("parent signup surfaces the password gate on empty submission", async ({ page }) => {
		await page.goto("/signup/parent");
		// The form has `noValidate` so HTML5-required is skipped; handleSubmit
		// runs and the shared `validatePasswordPair` schema is the first thing
		// to fail on empty fields ("Password must be at least 8 characters.").
		await page.getByRole("button", { name: /create parent account/i }).click();
		await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible();
	});

	test("teacher signup surfaces the password gate on empty submission", async ({ page }) => {
		await page.goto("/signup/teacher");
		await page.getByRole("button", { name: /create teacher account/i }).click();
		await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible();
	});
});

test.describe("Forgot password flow", () => {
	// Invalid-format input is short-circuited by the browser's native `type=email`
	// validation before the action ever runs (the form is not `noValidate`), so
	// that branch is exercised at the action level via Vitest, not here.

	test("valid-format email yields the enumeration-safe success copy", async ({ page }) => {
		await page.goto("/forgot-password");
		// Guaranteed-nonexistent email. The server action's contract is to
		// always return success on valid input, regardless of whether the
		// address resolves to a real account. The user-visible copy is the
		// "if that address is on file" line — same for real and fake addresses.
		await page
			.getByLabel(/email/i)
			.fill(`shape-only-${Date.now()}@example.invalid`);
		await page.getByRole("button", { name: /send reset link/i }).click();
		await expect(page.getByText(/if that address is on file/i)).toBeVisible();
	});
});

test.describe("Update password expired-link screen", () => {
	test("direct visit without a recovery cookie renders the expired UI", async ({ page }) => {
		await page.goto("/auth/update-password");
		await expect(page).toHaveTitle(/Set a new password · EduAI/);
		await expect(page.getByRole("heading", { name: /reset link expired/i })).toBeVisible();
		// Base UI's Button keeps `role="button"` on the rendered element even when
		// `render={<Link/>}` polymorphs the underlying tag to `<a>`. Match by
		// accessible name to assert the CTA is present.
		await expect(page.getByRole("button", { name: /request a new reset email/i })).toBeVisible();
	});
});
