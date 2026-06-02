/**
 * End-to-end visual + grading smoke: deep-links the practice wizard for two
 * visual-heavy subjects (Math grade 11 + Statistics grade 11), generates a
 * test, answers every question, submits, and waits for grading to complete.
 *
 * Used to validate the live visual-enrichment + grading pipelines together.
 *
 * Topic IDs were chosen from the live EDU_AI DB on 2026-05-27 for
 * student John Doe (grade 11, commerce_with_maths stream).
 *
 * Naming: matches `student-[\w-]+\.spec\.ts` so it loads the
 * student storage state from auth.setup.
 */
import { test, expect, type Page } from "@playwright/test";

const MATH_SUBJECT_ID = "fa07bf0f-31bc-4b99-941a-f827e40ce4d1";
const MATH_TOPIC_IDS = [
	"fa75ed8d-e354-4a0c-9cb8-1d06d8dd644b", // Conic Sections: Circle
	"94cdf0e4-0d54-4fa2-a10d-f6f6590aad21", // Conic Sections: Parabola
	"d8c49ee8-e6b9-4a2c-b48f-b84db6ef3bd9", // Conic Sections: Ellipse
	"133cfd91-cb0e-41ee-a527-9e7c9f4edf01", // Straight Lines: Slope of a Line
	"e6f5113b-a826-4aab-868d-3121dccd4635", // Trigonometric Functions
];

const STATS_SUBJECT_ID = "a990823a-c953-4d25-b7d1-703948109bd2";
const STATS_TOPIC_IDS = [
	"686aa5bf-7de8-4de9-b23e-fad50829293a", // Presentation of Data: Diagrammatic
	"a1d52107-dca7-4af5-a068-3b4e75120e9d", // Organisation: Frequency Distribution
	"0fa903a2-8d97-489f-9ce5-e3b1b076b9f2", // Organisation: Bivariate Frequency
	"40daf2f8-6819-4211-a73c-64ec50c61710", // Correlation: Types of Relationship
	"6db0034d-fca3-4266-bb38-37d0449737f6", // Correlation: Techniques for Measuring
];

/** Deep-link the wizard, walk to Generate, click it, click Start in the dialog. */
async function generateAndStart(
	page: Page,
	subjectId: string,
	topicIds: string[],
	label: string,
): Promise<string> {
	const url = `/student/practice?subjectId=${subjectId}&topicIds=${topicIds.join(",")}`;
	test.info().annotations.push({ type: "url", description: url });
	await page.goto(url, { waitUntil: "domcontentloaded" });

	const generateBtn = page.getByRole("button", { name: /generate practice test/i });
	for (let i = 0; i < 6; i++) {
		if (await generateBtn.isVisible().catch(() => false)) break;
		const candidates = [
			page.getByRole("button", { name: /^continue$/i }).first(),
			page.getByRole("button", { name: /save configuration/i }).first(),
			page.getByRole("button", { name: /build prompt preview/i }).first(),
		];
		let clicked = false;
		for (const cand of candidates) {
			if (
				(await cand.isVisible().catch(() => false)) &&
				(await cand.isEnabled().catch(() => false))
			) {
				await cand.click();
				clicked = true;
				break;
			}
		}
		if (!clicked) {
			await page.waitForTimeout(500);
			continue;
		}
		await page.waitForTimeout(800);
	}

	await expect(
		generateBtn,
		`[${label}] generate button never appeared`,
	).toBeVisible({ timeout: 15_000 });
	await generateBtn.click();

	// "Your test is ready" dialog after generation.
	const startBtn = page.getByRole("button", { name: /^start test$/i }).first();
	await expect(
		startBtn,
		`[${label}] start-test dialog never appeared`,
	).toBeVisible({
		timeout: 840_000, // 5call: ~11 min for 15Q tests + headroom
	});
	await startBtn.click();
	await page.waitForURL(/\/student\/practice\/[0-9a-f-]{36}(?:\?|$)/, {
		timeout: 30_000,
	});

	const m = page.url().match(/\/practice\/([0-9a-f-]{36})/);
	const testId = m?.[1];
	expect(testId, `[${label}] could not parse testId from URL`).toBeTruthy();
	console.log(`\n=== [${label}] generated testId: ${testId} ===\n`);
	test.info().annotations.push({ type: "testId", description: `${label}=${testId}` });
	return testId!;
}

/**
 * Answers the current question by question type, then opens the submit dialog
 * and confirms. Iterates forward by clicking Next until Next is disabled, then
 * submits.
 */
async function answerAllAndSubmit(page: Page, label: string): Promise<void> {
	for (let i = 0; i < 50; i++) {
		await page.waitForTimeout(400); // settle for card render

		// MCQ: tick the first option.
		const mcqRadio = page.locator('input[type="radio"][name^="mcq-"]').first();
		if (await mcqRadio.isVisible().catch(() => false)) {
			await mcqRadio.check({ force: true }).catch(() => undefined);
		}

		// Numerical / fill_in_blank.
		const plainInput = page
			.locator('input[data-practice-answer-field="true"]')
			.first();
		if (await plainInput.isVisible().catch(() => false)) {
			await plainInput.fill("1");
		}

		// short_answer / long_answer (TipTap ProseMirror). Focus + type via keyboard
		// so the editor's keymap registers the input.
		const proseMirror = page.locator(".ProseMirror[contenteditable='true']").first();
		if (await proseMirror.isVisible().catch(() => false)) {
			await proseMirror.click();
			await page.keyboard.type("Smoke-test answer placeholder.", { delay: 1 });
		}

		// Advance.
		const nextBtn = page.getByRole("button", { name: /^next$/i }).first();
		const canNext =
			(await nextBtn.isVisible().catch(() => false)) &&
			(await nextBtn.isEnabled().catch(() => false));
		if (!canNext) break;
		await nextBtn.click();
	}

	// Open the submit dialog from the card footer.
	const submitInCard = page
		.getByRole("button", { name: /^submit test$/i })
		.first();
	await expect(
		submitInCard,
		`[${label}] in-card submit button missing`,
	).toBeVisible({ timeout: 10_000 });
	await submitInCard.click();

	// Confirmation dialog has a "Submit test" button. The card-footer one stays
	// in the DOM, so target the dialog explicitly.
	const dialogConfirm = page
		.getByRole("dialog")
		.getByRole("button", { name: /^submit test$/i });
	await expect(
		dialogConfirm,
		`[${label}] confirm submit dialog never appeared`,
	).toBeVisible({ timeout: 10_000 });
	await dialogConfirm.click();

	// After successful submit, server action redirects off the session URL.
	await page.waitForURL(
		(url) => !/\/practice\/[0-9a-f-]{36}\/?$/.test(url.pathname),
		{ timeout: 60_000 },
	);
	console.log(`\n=== [${label}] submitted → redirected to ${page.url()} ===\n`);
}

/**
 * Polls the test's `/grading` route. That route is a server-rendered redirect
 * checker: when status='graded' it 307s to `/student/reports?...&test=...`.
 * We follow the redirect and inspect the final URL — much more robust than
 * regex-matching rendered HTML.
 */
async function waitForGraded(page: Page, testId: string, label: string): Promise<string> {
	const deadline = Date.now() + 600_000; // 10 min cap
	let lastStatus = "unknown";

	while (Date.now() < deadline) {
		const finalUrl = await page
			.evaluate(async (id) => {
				const res = await fetch(`/student/practice/${id}/grading`, {
					redirect: "follow",
					cache: "no-store",
				});
				return res.url;
			}, testId)
			.catch(() => "");

		if (/\/student\/reports/.test(finalUrl)) {
			lastStatus = "graded";
			break;
		}
		if (/\/grading(?:\?|$)/.test(finalUrl)) {
			lastStatus = "grading";
		} else if (/\/practice\/[0-9a-f-]+\/?(?:\?|$)/.test(finalUrl)) {
			// Bounced back to session = grading_failed / not enqueued.
			lastStatus = "grading_not_started";
		}
		await page.waitForTimeout(8_000);
	}

	console.log(`\n=== [${label}] final UI status: ${lastStatus} (test ${testId}) ===\n`);
	test.info().annotations.push({
		type: "gradedStatus",
		description: `${label}=${lastStatus}`,
	});
	return lastStatus;
}

test.describe.configure({ mode: "serial" });

test("Math 5call — generate → answer → submit → wait for graded", async ({ page }) => {
	test.setTimeout(1_500_000); // 25 min cap
	const testId = await generateAndStart(page, MATH_SUBJECT_ID, MATH_TOPIC_IDS, "MATH");
	await answerAllAndSubmit(page, "MATH");
	const status = await waitForGraded(page, testId, "MATH");
	expect(["graded"]).toContain(status);
});

test("Stats 5call — generate → answer → submit → wait for graded", async ({ page }) => {
	test.setTimeout(1_500_000);
	const testId = await generateAndStart(page, STATS_SUBJECT_ID, STATS_TOPIC_IDS, "STATS");
	await answerAllAndSubmit(page, "STATS");
	const status = await waitForGraded(page, testId, "STATS");
	expect(["graded"]).toContain(status);
});
