import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
	/Failed to load resource.*sentry/i,
	/sentry.*not configured/i,
	/Download the React DevTools/i,
	/\[Fast Refresh\]/i,
	/Content Security Policy directive/i,
	/violates the following Content Security Policy/i,
];

function attachConsoleCollector(page: Page): { errors: string[] } {
	const errors: string[] = [];
	page.on("console", (msg: ConsoleMessage) => {
		const text = msg.text();
		if (IGNORED_CONSOLE_PATTERNS.some((p) => p.test(text))) return;
		if (msg.type() === "error") errors.push(text);
	});
	page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
	return { errors };
}

async function isOnLogin(page: Page): Promise<boolean> {
	return /\/login/.test(new URL(page.url()).pathname);
}

test.describe("Student QnA logs", () => {
	test("route renders and row modal opens", async ({ page }) => {
		const { errors } = attachConsoleCollector(page);

		await page.goto("/student/qna-logs", { waitUntil: "domcontentloaded" });
		test.skip(await isOnLogin(page), "Account is not a student.");

		await expect(page.getByRole("heading", { name: /qna logs/i })).toBeVisible();

		const firstRow = page.locator("tbody tr").first();
		const rowVisible = await firstRow.isVisible({ timeout: 3000 }).catch(() => false);

		if (rowVisible) {
			await firstRow.click();
			await expect(page.getByText(/Question details/i).first()).toBeVisible();
			await expect(
				page.getByText(/You got this|Almost there|Not quite|Awaiting grade/i).first(),
			).toBeVisible();
			await expect(page.getByRole("button", { name: /Previous/i })).toBeVisible();
			await expect(page.getByRole("button", { name: /^Next$/i })).toBeVisible();
			await page.keyboard.press("Escape");
		} else {
			const emptyMessage = page.getByText(/build your qna log|no questions match/i).first();
			const paginationZero = page.getByText(/Showing 0–0 of 0|Showing 0-0 of 0/i).first();
			const hasEmptyMessage = await emptyMessage.isVisible({ timeout: 1000 }).catch(() => false);
			const hasZeroRange = await paginationZero.isVisible({ timeout: 1000 }).catch(() => false);
			expect(hasEmptyMessage || hasZeroRange).toBe(true);
		}

		expect(errors, `Console errors on qna logs: ${errors.join("\n")}`).toHaveLength(0);
	});
});
