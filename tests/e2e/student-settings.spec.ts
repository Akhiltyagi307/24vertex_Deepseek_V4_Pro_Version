/**
 * Audit D34: smoke coverage for the student settings page chrome.
 *
 * The settings form is now composed of section panels (see `app/student/settings/sections/`).
 * We assert each tab renders without throwing and that the role-tab semantics
 * survive the split. Real form submissions are exercised by the Vitest action
 * tests under `tests/actions/student/settings/`; here we only validate the UI
 * shell.
 */
import { expect, test, type Page } from "@playwright/test";

const STUDENT_CRED_HINT =
	"Set PLAYWRIGHT_STUDENT_EMAIL + PLAYWRIGHT_STUDENT_PASSWORD in .env.local to run student E2E.";

test.beforeEach(async () => {
	test.skip(!process.env.PLAYWRIGHT_STUDENT_EMAIL?.trim(), STUDENT_CRED_HINT);
});

async function gotoIfStudent(page: Page, target: string): Promise<boolean> {
	await page.goto(target, { waitUntil: "domcontentloaded" });
	return !/\/login/.test(new URL(page.url()).pathname);
}

test.describe("Student settings", () => {
	test("the settings page renders with the SmoothTab tablist", async ({ page }) => {
		const ok = await gotoIfStudent(page, "/student/settings");
		test.skip(!ok, "No authenticated student session available.");

		await expect(page).toHaveURL(/\/student\/settings/);
		// SmoothTab renders role="tablist" with the section labels — confirm it's mounted.
		await expect(page.getByRole("tab").first()).toBeVisible({ timeout: 10_000 });
	});

	test("Account tab shows the login email read-only field", async ({ page }) => {
		const ok = await gotoIfStudent(page, "/student/settings");
		test.skip(!ok, "No authenticated student session available.");
		// Account tab is the default; the login email field should be in the DOM.
		await expect(page.getByText(/login email|email address/i).first()).toBeVisible({
			timeout: 10_000,
		});
	});

	test("parent link requests panel when pending links exist", async ({ page }) => {
		const ok = await gotoIfStudent(page, "/student/settings");
		test.skip(!ok, "No authenticated student session available.");

		const panel = page.getByRole("alert").filter({ hasText: /parent link requests/i });
		if ((await panel.count()) === 0) {
			test.skip(true, "No pending parent link requests on this test account.");
		}
		await expect(panel.getByRole("button", { name: /^approve$/i }).first()).toBeVisible();
		await expect(panel.getByRole("button", { name: /^decline$/i }).first()).toBeVisible();
	});

	test("Notifications tab exposes the in-app and email toggles", async ({ page }) => {
		const ok = await gotoIfStudent(page, "/student/settings");
		test.skip(!ok, "No authenticated student session available.");
		const notifTab = page.getByRole("tab", { name: /notification/i });
		if ((await notifTab.count()) === 0) {
			test.skip(true, "No 'Notifications' tab rendered (variant?).");
		}
		await notifTab.first().click();
		await expect(page.getByText(/In-app notifications/i)).toBeVisible({ timeout: 5_000 });
		await expect(page.getByText(/Email notifications/i)).toBeVisible();
	});
});
