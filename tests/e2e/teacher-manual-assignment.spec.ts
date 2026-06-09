/**
 * Teacher manual-assignment E2E.
 *
 * Drives the real UI: AI/Manual switch -> manual builder -> per-type question
 * editor (MCQ) -> chapter/topic picker -> Save draft (and, when a student is in
 * scope, Publish). Asserts the draft/publish succeeds via the real server action
 * + Drizzle query against the configured Supabase project.
 *
 * Runs in the `teacher` Playwright project (auth via educator-auth.setup.ts).
 * Skips cleanly when PLAYWRIGHT_TEACHER_EMAIL is unset.
 *
 * Created rows are titled with an [e2e-pw] prefix so they can be purged after.
 *
 * Note: selects are targeted via getByRole("combobox", { name }) — the accessible
 * name comes from aria-label, which can differ from the wrapping <label> text
 * (e.g. the topic picker's label reads "Chapter & topic" but its aria-label is
 * "Chapter and topic").
 */

import { test, expect, type Page } from "@playwright/test";

const CRED_HINT =
	"Set PLAYWRIGHT_TEACHER_EMAIL + PLAYWRIGHT_TEACHER_PASSWORD in .env.local to run manual-assignment E2E.";

test.beforeEach(async () => {
	test.skip(!process.env.PLAYWRIGHT_TEACHER_EMAIL?.trim(), CRED_HINT);
});

function subjectSelect(page: Page) {
	return page.getByRole("combobox", { name: "Subject", exact: true });
}
function topicSelect(page: Page) {
	return page.getByRole("combobox", { name: "Chapter and topic" }).first();
}

/**
 * Select the first subject that has topics (and, when required, at least one
 * selectable student). Returns whether a usable subject was found.
 */
async function pickAuthorableSubject(page: Page, requireStudent: boolean): Promise<boolean> {
	const subject = subjectSelect(page);
	const subjectCount = await subject.locator("option").count();
	for (let i = 0; i < subjectCount; i++) {
		await subject.selectOption({ index: i });
		// Topic options re-render after the subject changes.
		let topicCount = 0;
		for (let t = 0; t < 12; t++) {
			topicCount = await topicSelect(page).locator("option").count();
			if (topicCount > 1) break;
			await page.waitForTimeout(150);
		}
		if (topicCount <= 1) continue;
		if (requireStudent && (await page.getByRole("checkbox").count()) === 0) continue;
		await topicSelect(page).selectOption({ index: 1 }); // index 0 is the placeholder
		return true;
	}
	return false;
}

async function fillFirstMcqQuestion(page: Page): Promise<void> {
	await page.getByRole("textbox", { name: /question \(use/i }).first().fill("What is 2 + 2?");
	await page.getByPlaceholder("Option A").fill("3");
	await page.getByPlaceholder("Option B").fill("4");
	// First question defaults to multiple_choice with option A pre-selected as correct.
}

test.describe("Teacher manual assignment", () => {
	test("author and save a manual assignment draft via the UI", async ({ page }) => {
		test.setTimeout(120_000);
		const title = `[e2e-pw] Manual draft ${Date.now()}`;

		await page.goto("/teacher/assignments", { waitUntil: "domcontentloaded" });
		await page.getByRole("button", { name: /write my own/i }).click();
		await expect(page.getByRole("button", { name: /save draft/i })).toBeVisible({ timeout: 30_000 });

		await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
		expect(await pickAuthorableSubject(page, false), "expected a subject with topics").toBe(true);
		await fillFirstMcqQuestion(page);

		await page.getByRole("button", { name: /save draft/i }).click();
		await expect(page.getByText(/draft saved/i)).toBeVisible({ timeout: 30_000 });
	});

	test("publish a manual assignment to a student in scope", async ({ page }) => {
		test.setTimeout(120_000);
		const title = `[e2e-pw] Manual publish ${Date.now()}`;

		await page.goto("/teacher/assignments", { waitUntil: "domcontentloaded" });
		await page.getByRole("button", { name: /write my own/i }).click();
		await expect(page.getByRole("button", { name: /publish assignment/i })).toBeVisible({ timeout: 30_000 });

		await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
		const ready = await pickAuthorableSubject(page, true);
		test.skip(!ready, "No subject with both topics and a student in this teacher's scope.");
		await fillFirstMcqQuestion(page);
		await page.getByRole("checkbox").first().check();

		await page.getByRole("button", { name: /publish assignment/i }).click();
		await expect(page.getByText(/published for \d+ student/i)).toBeVisible({ timeout: 45_000 });
	});
});
