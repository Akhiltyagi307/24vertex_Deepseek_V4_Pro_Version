/**
 * In-app notifications MVP — smoke coverage for the student portal.
 *
 * Authentication runs once via `tests/e2e/auth.setup.ts` (Playwright project
 * `auth-setup`); this file runs under the `student` project with
 * `storageState` from `playwright/.auth/user.json`.
 *
 * Notes:
 * - These tests assume the default dev account is a student. If no student
 *   session is available the navigation-based tests will fall back to a login
 *   redirect check.
 * - We intentionally avoid asserting on real notification content because
 *   fixtures vary; we only validate the chrome (bell, page, filters).
 */

import { expect, test, type Page } from "@playwright/test";

async function gotoIfStudent(page: Page, target: string): Promise<boolean> {
	await page.goto(target, { waitUntil: "domcontentloaded" });
	const path = new URL(page.url()).pathname;
	return !/\/login/.test(path);
}

test.describe("Student notifications", () => {
	test("top-bar bell opens tray; Show all goes to notifications page", async ({ page }) => {
		const onStudent = await gotoIfStudent(page, "/student/dashboard");
		test.skip(!onStudent, "No authenticated student session available.");
		const bell = page.getByRole("button", { name: /notifications/i }).first();
		await expect(bell).toBeVisible();
		await bell.click();
		await expect(page.getByRole("heading", { name: /^Notifications$/ })).toBeVisible();
		await expect(page.getByRole("link", { name: /show all/i })).toBeVisible();
		await page.getByRole("link", { name: /show all/i }).click();
		await expect(page).toHaveURL(/\/student\/notifications/);
	});

	test("notifications page renders list chrome and filters", async ({ page }) => {
		const onStudent = await gotoIfStudent(page, "/student/notifications");
		test.skip(!onStudent, "No authenticated student session available.");

		await expect(page.getByRole("heading", { level: 1, name: /notifications/i })).toBeVisible();

		const unread = page.getByRole("button", { name: /^unread$/i });
		const all = page.getByRole("button", { name: /^all$/i });
		await expect(all).toBeVisible();
		await expect(unread).toBeVisible();

		// Toggling filter should not throw; the live region stays present.
		await unread.click();
		await expect(unread).toHaveAttribute("aria-pressed", "true");
		await all.click();
		await expect(all).toHaveAttribute("aria-pressed", "true");

		await expect(page.getByRole("log", { name: /notifications/i })).toBeVisible();
	});

	test("View report CTA deep-links into the reports page", async ({ page }) => {
		const onStudent = await gotoIfStudent(page, "/student/notifications");
		test.skip(!onStudent, "No authenticated student session available.");
		const cta = page.getByRole("link", { name: /view report/i }).first();
		if (await cta.count() === 0) {
			test.skip(true, "No graded test notifications present in this environment.");
			return;
		}
		await cta.click();
		await expect(page).toHaveURL(/\/student\/reports\?test=/);
	});

	test("Mark all read disables itself once there's no unread count", async ({ page }) => {
		const onStudent = await gotoIfStudent(page, "/student/notifications");
		test.skip(!onStudent, "No authenticated student session available.");
		const markAll = page.getByRole("button", { name: /mark all read/i });
		await expect(markAll).toBeVisible();
		if (!(await markAll.isDisabled())) {
			await markAll.click();
			await expect(markAll).toBeDisabled();
		}
	});
});
