import { expect, test } from "@playwright/test";

const PARENT_CRED_HINT =
	"Set PLAYWRIGHT_PARENT_EMAIL + PLAYWRIGHT_PARENT_PASSWORD in .env.local to run parent E2E.";

test.beforeEach(async () => {
	test.skip(!process.env.PLAYWRIGHT_PARENT_EMAIL?.trim(), PARENT_CRED_HINT);
});

test.describe("Parent QnA logs", () => {
	test("linked parent can reach qna logs page", async ({ page }) => {
		await page.goto("/parent/qna-logs", { waitUntil: "domcontentloaded" });
		const path = new URL(page.url()).pathname;

		if (path !== "/parent/qna-logs") {
			test.skip(
				path === "/parent/select-student" || path === "/parent/link-child",
				`Parent account is not linked to a child (${path}).`,
			);
		}

		await expect(page.getByRole("heading", { name: /qna logs/i })).toBeVisible();
		await expect(page.getByText(/your child/i).first()).toBeVisible();
	});
});
