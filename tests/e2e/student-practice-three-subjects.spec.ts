import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Practice E2E: ONE-OFF spec that runs three specific subjects (Class 11 commerce):
 *   Financial Accounting Part 2, Mathematics, Business Studies.
 *
 * Picks 7 random topics per subject, generates a test, answers a subset, submits,
 * waits for graded report row, and writes a JSON artifact at
 *   playwright-report/three-subjects-runs.json
 * with the captured test_id/correlation_id per subject so an out-of-band metrics
 * script can resolve cost/tokens/visuals from Supabase after the run.
 *
 * Env (student project — relies on auth.setup storage state):
 *   - PLAYWRIGHT_E2E_TARGET_USER_ID  (student UUID — bypasses email-lookup race
 *                                     when two auth.users rows share an email)
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const STUDENT_USER_ID = (process.env.PLAYWRIGHT_E2E_TARGET_USER_ID ?? "").trim();

const TARGET_SUBJECT_NAMES = [
	"Mathematics",
	"Science",
	"Economics",
	"History",
	"Political Science",
	"Geography",
];
const TARGET_GRADE = 9;
const TOPICS_PER_SUBJECT = 7;
const ARTIFACT_PATH = path.resolve(
	__dirname,
	"..",
	"..",
	"playwright-report",
	"three-subjects-runs.json",
);

const SKIP_REASON =
	!STUDENT_USER_ID ?
		"PLAYWRIGHT_E2E_TARGET_USER_ID not set"
	: !SUPABASE_URL ?
		"NEXT_PUBLIC_SUPABASE_URL not set"
	: !SERVICE_ROLE ?
		"SUPABASE_SERVICE_ROLE_KEY not set"
	:	null;

const ADMIN_HEADERS = (): Record<string, string> => ({
	apikey: SERVICE_ROLE,
	Authorization: `Bearer ${SERVICE_ROLE}`,
});

type TrackerRow = {
	id: string;
	subject_id: string;
	topic_id: string;
	tests_taken: number | null;
	updated_at: string | null;
};

type SubjectMeta = { id: string; name: string; grade: number | null };
type SubjectPlan = SubjectMeta & { trackers: TrackerRow[] };

function shuffle<T>(xs: readonly T[]): T[] {
	const a = [...xs];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j]!, a[i]!];
	}
	return a;
}

function regexEscape(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadFilteredSubjectPlans(
	request: import("@playwright/test").APIRequestContext,
): Promise<SubjectPlan[]> {
	const trackerResp = await request.get(
		`${SUPABASE_URL}/rest/v1/performance_tracker?student_id=eq.${encodeURIComponent(STUDENT_USER_ID)}&select=id,subject_id,topic_id,tests_taken,updated_at`,
		{ headers: { ...ADMIN_HEADERS(), Accept: "application/json" } },
	);
	expect(trackerResp.ok(), `tracker fetch failed ${trackerResp.status()}`).toBe(true);
	const trackers = (await trackerResp.json()) as TrackerRow[];
	expect(trackers.length, "student must have tracker rows").toBeGreaterThan(0);

	const subjectIds = [...new Set(trackers.map((t) => t.subject_id))];
	const subResp = await request.get(
		`${SUPABASE_URL}/rest/v1/subjects?id=in.(${subjectIds.join(",")})&select=id,name,grade`,
		{ headers: { ...ADMIN_HEADERS(), Accept: "application/json" } },
	);
	expect(subResp.ok(), `subjects fetch failed ${subResp.status()}`).toBe(true);
	const subjects = (await subResp.json()) as SubjectMeta[];

	const wantedNames = new Set(TARGET_SUBJECT_NAMES.map((n) => n.toLowerCase()));
	const filteredMeta = subjects.filter(
		(s) => s.grade === TARGET_GRADE && wantedNames.has(s.name.toLowerCase()),
	);

	const plans: SubjectPlan[] = [];
	for (const wanted of TARGET_SUBJECT_NAMES) {
		const meta = filteredMeta.find((m) => m.name.toLowerCase() === wanted.toLowerCase());
		expect(
			meta,
			`Grade ${TARGET_GRADE} '${wanted}' must exist with tracker rows for student ${STUDENT_USER_ID}`,
		).toBeTruthy();
		const subTrackers = trackers.filter((t) => t.subject_id === meta!.id);
		expect(
			subTrackers.length,
			`Tracker rows must exist for '${wanted}' (${meta!.id})`,
		).toBeGreaterThan(0);
		plans.push({ ...meta!, trackers: subTrackers });
	}
	return plans;
}

async function fetchTopicLabels(
	request: import("@playwright/test").APIRequestContext,
	topicIds: string[],
): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	for (const id of topicIds) {
		const r = await request.get(
			`${SUPABASE_URL}/rest/v1/topics?id=eq.${encodeURIComponent(id)}&select=topic_name`,
			{ headers: { ...ADMIN_HEADERS(), Accept: "application/json" } },
		);
		if (!r.ok()) continue;
		const rows = (await r.json()) as { topic_name?: string | null }[];
		const nm = rows[0]?.topic_name?.trim();
		out.set(id, nm && nm.length > 0 ? nm : id);
	}
	return out;
}

async function pickEasyDifficulty(page: import("@playwright/test").Page) {
	const easyRadio = page.locator("#diff-easy");
	if (await easyRadio.isVisible().catch(() => false)) await easyRadio.check();
}

async function answerCurrentQuestionBestEffort(
	page: import("@playwright/test").Page,
): Promise<boolean> {
	const mcq = page
		.locator("fieldset")
		.filter({ hasText: "Select an answer" })
		.locator('input[type="radio"]')
		.first();
	if (await mcq.isVisible().catch(() => false)) {
		await mcq.check();
		return true;
	}
	const simple = page.locator("[data-practice-answer-field]").first();
	if (await simple.isVisible().catch(() => false)) {
		await simple.fill("e2e");
		return true;
	}
	const tiptap = page.locator("[data-rich-answer-editor] .tiptap").first();
	if (await tiptap.isVisible().catch(() => false)) {
		await tiptap.click();
		await page.keyboard.insertText("Automated student answer.");
		return true;
	}
	return false;
}

async function waitForGenerationOutcome(
	page: import("@playwright/test").Page,
	timeoutMs: number,
): Promise<void> {
	const readyDialog = page.getByRole("dialog", { name: /Your test is ready/i });
	const somethingWrong = page.getByRole("alert").filter({ hasText: /Something went wrong/i });
	const checkStep = page.getByRole("alert").filter({ hasText: /Check this step/i });
	const winner = readyDialog.or(somethingWrong).or(checkStep);
	await expect(winner.first()).toBeVisible({ timeout: timeoutMs });
	if (await somethingWrong.first().isVisible().catch(() => false)) {
		const text = await somethingWrong.first().innerText().catch(() => "");
		throw new Error(`Practice pipeline error: ${text.slice(0, 800)}`);
	}
	if (await checkStep.first().isVisible().catch(() => false)) {
		const text = await checkStep.first().innerText().catch(() => "");
		throw new Error(`Practice wizard error: ${text.slice(0, 800)}`);
	}
	await expect(readyDialog).toBeVisible({ timeout: 10_000 });
}

async function waitForReportsRow(
	page: import("@playwright/test").Page,
	testId: string,
	timeoutMs: number,
) {
	const safeId = testId.replace(/[^0-9a-f-]/gi, "");
	const row = page.locator(`#report-row-${safeId}`);
	await expect(row).toBeVisible({ timeout: timeoutMs });
}

async function pollReportReady(
	request: import("@playwright/test").APIRequestContext,
	testId: string,
	maxWaitMs: number,
): Promise<{ ok: boolean; grading_error?: string | null }> {
	const deadline = Date.now() + maxWaitMs;
	while (Date.now() < deadline) {
		const r = await request.get(
			`${SUPABASE_URL}/rest/v1/test_reports?test_id=eq.${encodeURIComponent(testId)}&select=id,grading_error`,
			{ headers: { ...ADMIN_HEADERS(), Accept: "application/json" } },
		);
		if (r.ok()) {
			const rows = (await r.json()) as { id?: string; grading_error?: string | null }[];
			const row = rows[0];
			if (row?.id) return { ok: true, grading_error: row.grading_error ?? null };
		}
		await new Promise((res) => setTimeout(res, 3_000));
	}
	return { ok: false };
}

type SubjectRunSummary = {
	subject_name: string;
	subject_id: string;
	test_id: string;
	topic_ids: string[];
	topic_labels: string[];
	wall_seconds: number;
	generation_seconds: number;
	answer_submit_seconds: number;
	grading_wait_seconds: number;
	grading_error: string | null;
	warnings: string[];
	started_at: string;
	finished_at: string;
};

function appendArtifact(summary: SubjectRunSummary) {
	fs.mkdirSync(path.dirname(ARTIFACT_PATH), { recursive: true });
	let prior: SubjectRunSummary[] = [];
	if (fs.existsSync(ARTIFACT_PATH)) {
		try {
			prior = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf-8"));
			if (!Array.isArray(prior)) prior = [];
		} catch {
			prior = [];
		}
	}
	// De-dupe by subject_id so re-runs of a single subject overwrite the prior row.
	prior = prior.filter((p) => p.subject_id !== summary.subject_id);
	prior.push(summary);
	fs.writeFileSync(ARTIFACT_PATH, JSON.stringify(prior, null, 2));
}

test.describe("Three-subject practice run (FA-Part-2, Mathematics, Business Studies)", () => {
	test.skip(SKIP_REASON !== null, SKIP_REASON ?? "");
	// Sequential (fullyParallel: false in config), but a failure of one subject must
	// NOT skip the rest — `.serial` would. Two retries cover transient DeepSeek
	// AI_APICallError ("Failed to process successful response") seen during dev.
	test.describe.configure({ retries: 2 });

	let plans: SubjectPlan[] = [];

	test.beforeAll(async ({ request }) => {
		test.setTimeout(120_000); // beforeAll only — Supabase fetches can be slow under load
		plans = await loadFilteredSubjectPlans(request);
		console.log(
			`[three-subjects] student=${STUDENT_USER_ID} grade=${TARGET_GRADE} subjects=`,
			plans.map((p) => `${p.name} (${p.trackers.length} topics)`).join("; "),
		);
	});

	for (const targetName of TARGET_SUBJECT_NAMES) {
		test(`Practice · ${targetName}`, async ({ page, request }, testInfo) => {
			test.setTimeout(60 * 60 * 1000); // 60 minutes per subject

			const subj = plans.find((p) => p.name === targetName);
			expect(subj, `plan for '${targetName}'`).toBeTruthy();

			const warnings: string[] = [];
			const startedIso = new Date().toISOString();
			const tWall0 = Date.now();

			// --- choose topics, dedupe ambiguous labels ---
			const allTopicIds = [...new Set(subj!.trackers.map((t) => t.topic_id))];
			const labelMap = await fetchTopicLabels(request, allTopicIds);
			const labelCounts = new Map<string, number>();
			for (const id of allTopicIds) {
				const lbl = labelMap.get(id) ?? id;
				labelCounts.set(lbl, (labelCounts.get(lbl) ?? 0) + 1);
			}
			const unambiguous = subj!.trackers.filter(
				(t) => (labelCounts.get(labelMap.get(t.topic_id) ?? t.topic_id) ?? 0) === 1,
			);
			const pool = unambiguous.length > 0 ? unambiguous : subj!.trackers;
			if (unambiguous.length < subj!.trackers.length) {
				warnings.push(
					`Dropped ${subj!.trackers.length - unambiguous.length} ambiguous duplicate-label topics`,
				);
			}
			const want = Math.min(TOPICS_PER_SUBJECT, pool.length);
			const picked = shuffle(pool).slice(0, want);
			const topicIds = [...new Set(picked.map((p) => p.topic_id))];
			const topicLabels = topicIds.map((id) => labelMap.get(id) ?? id);

			let testId: string | null = null;
			let tGenStart = 0;
			let tGenEnd = 0;
			let tAnswerEnd = 0;

			await test.step(`${targetName}: wizard → generate → session`, async () => {
				await page.goto("/student/practice");
				await expect(page.getByRole("heading", { name: /^Practice$/i })).toBeVisible({
					timeout: 45_000,
				});

				await page
					.locator('button[type="button"]')
					.filter({ has: page.getByText(subj!.name, { exact: true }) })
					.first()
					.click();

				const step0Continue = page.getByRole("button", { name: /^Continue$/i }).first();
				await expect(step0Continue).toBeEnabled({ timeout: 15_000 });
				await step0Continue.click();

				await expect(page.getByRole("heading", { name: /^Topics$/i })).toBeVisible({
					timeout: 30_000,
				});
				await page
					.getByRole("button", { name: "Clear", exact: true })
					.click({ timeout: 8_000 })
					.catch(() => {});
				await page.getByRole("button", { name: "Expand all" }).click({ timeout: 10_000 });

				for (const label of topicLabels) {
					const cb = page
						.getByRole("checkbox", {
							name: new RegExp(`^Select\\s+${regexEscape(label)}\\s*$`, "i"),
						})
						.first();
					await expect(cb).toBeVisible({ timeout: 60_000 });
					await cb.check();
				}

				await page.getByRole("button", { name: /^Continue$/i }).click();
				await pickEasyDifficulty(page);
				await page.getByRole("button", { name: /Save configuration/i }).click();
				await expect(page.getByText(/Ready to generate/i)).toBeVisible({ timeout: 60_000 });

				tGenStart = Date.now();
				await page.getByRole("button", { name: /Generate practice test/i }).click();
				await waitForGenerationOutcome(page, 600_000); // 10 min ceiling
				tGenEnd = Date.now();

				await page.getByRole("button", { name: /^Start test$/i }).click();
				await page.waitForURL(/\/student\/practice\/[0-9a-f-]{36}/i, { timeout: 45_000 });
				const m = page.url().match(/\/student\/practice\/([0-9a-f-]{36})/i);
				testId = m?.[1] ?? null;
				expect(testId, "captured test id").toBeTruthy();
			});

			await test.step(`${targetName}: answer & submit`, async () => {
				await expect(page.getByRole("button", { name: /Submit test/i }).first()).toBeVisible({
					timeout: 90_000,
				});
				const answerCap = 5;
				for (let qi = 0; qi < answerCap; qi++) {
					const ok = await answerCurrentQuestionBestEffort(page);
					if (!ok) {
						warnings.push(`No answer control found at iteration ${qi}, stopping early`);
						break;
					}
					const nextBtn = page.getByRole("button", { name: /^Next$/i });
					if ((await nextBtn.isVisible()) && (await nextBtn.isEnabled())) {
						await nextBtn.click();
						await page.waitForTimeout(250);
					}
				}
				await page.getByRole("button", { name: /^Submit test$/i }).first().click();
				await page.getByRole("dialog").getByRole("button", { name: /^Submit test$/i }).click();
				tAnswerEnd = Date.now();
			});

			await test.step(`${targetName}: grading → reports`, async () => {
				await page.waitForURL(
					(u) => {
						const onGrading =
							testId !== null && u.pathname.endsWith(`/student/practice/${testId}/grading`);
						const onReports = u.pathname.startsWith("/student/reports");
						return onGrading || onReports;
					},
					{ timeout: 600_000 },
				);
				if (!/^\/student\/reports/.test(new URL(page.url()).pathname)) {
					await page.waitForURL((u) => u.pathname.startsWith("/student/reports"), {
						timeout: 600_000,
					});
				}
				await waitForReportsRow(page, testId!, 300_000);
			});

			const rowPoll = await pollReportReady(request, testId!, 240_000);
			expect(rowPoll.ok, "test_reports row exists after grading UI").toBe(true);

			const tEnd = Date.now();
			const summary: SubjectRunSummary = {
				subject_name: subj!.name,
				subject_id: subj!.id,
				test_id: testId!,
				topic_ids: topicIds,
				topic_labels: topicLabels,
				wall_seconds: Number(((tEnd - tWall0) / 1000).toFixed(1)),
				generation_seconds: Number(((tGenEnd - tGenStart) / 1000).toFixed(1)),
				answer_submit_seconds: Number(((tAnswerEnd - tGenEnd) / 1000).toFixed(1)),
				grading_wait_seconds: Number(((tEnd - tAnswerEnd) / 1000).toFixed(1)),
				grading_error: rowPoll.grading_error ?? null,
				warnings,
				started_at: startedIso,
				finished_at: new Date().toISOString(),
			};
			appendArtifact(summary);
			await testInfo.attach(`${subj!.name}.json`, {
				body: Buffer.from(JSON.stringify(summary, null, 2)),
				contentType: "application/json",
			});
			console.log(
				`[three-subjects] ${subj!.name} OK test_id=${testId} wall=${summary.wall_seconds}s gen=${summary.generation_seconds}s`,
			);
		});
	}
});
