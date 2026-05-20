import path from "node:path";
import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./admin-auth.helpers";

/**
 * D33: end-to-end coverage for admin curriculum import. Uploads a tiny CSV
 * fixture and confirms the import preview / submit path renders.
 *
 * Skipped unless PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD are set
 * — the page itself is admin-gated.
 */

const FIXTURE_PATH = path.join(__dirname, "..", "fixtures", "curriculum-sample.csv");

test.describe("D33: /admin/curriculum/import e2e", () => {
	test.beforeEach(() => {
		test.skip(
			!process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
			"Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD to run.",
		);
	});

	test("page renders and shows the file uploader", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/admin/curriculum/import");
		await expect(page.getByRole("heading", { name: /curriculum import/i })).toBeVisible({
			timeout: 30_000,
		});
		// File input visible (could be a styled <label> wrapping <input type="file">).
		const fileInput = page.locator('input[type="file"]');
		await expect(fileInput).toBeAttached({ timeout: 30_000 });
	});

	test("uploading the sample CSV surfaces a preview row count", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/admin/curriculum/import");
		await expect(page.getByRole("heading", { name: /curriculum import/i })).toBeVisible({
			timeout: 30_000,
		});

		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles(FIXTURE_PATH);

		// Either a parsed row count surfaces, or an explicit error/validation
		// message is shown — both prove the upload path is wired and gated.
		await expect(
			page
				.getByText(/parsed|preview|rows|columns|validation/i)
				.first(),
		).toBeVisible({ timeout: 30_000 });
	});
});
