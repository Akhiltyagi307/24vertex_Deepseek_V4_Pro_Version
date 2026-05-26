/**
 * DeepSeek migration validation: run 3 practice generations end-to-end across
 * core (non-English) subjects, measure generation latency and grading latency
 * separately, and dump a markdown summary. The test runs serially so one slow
 * subject doesn't tank the others, and writes per-subject + aggregate timing
 * data to the Playwright report as annotations.
 *
 * Subjects: Physics Part 1, Chemistry Part 1, Mathematics — picked because
 * they exercise different blueprint paths (visual-heavy physics, formula-heavy
 * chemistry, math-only MCQ). English is intentionally excluded per the
 * request brief.
 *
 * Env requirements: same as practice-full-subjects.spec.ts.
 */

import { expect, test } from "@playwright/test";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const STUDENT_EMAIL = (
	process.env.PLAYWRIGHT_USER_EMAIL ??
	process.env["playwright_user_email"] ??
	""
).trim();

// Student's stream got reset to Commerce on 2026-05-26 — Physics + Chemistry
// trackers were replaced. Targeting two visual-rich Commerce subjects:
// Accountancy (T-accounts, journals, balance sheets) and Economics
// (supply/demand curves, indifference curves).
const TARGET_SUBJECTS = ["Financial Accounting Part 1", "Economics", "Statistics"] as const;

/**
 * Tier-1 topic pinning. When a subject is in this map, the test uses ONLY
 * the listed topic_ids (no random pick) so each question MUST have a table
 * to be answerable. Lets us cleanly attribute "0 visuals" to Flash schema
 * reliability rather than topic-selection variance.
 *
 * Accountancy pins:
 *  - The Ledger              — T-account is the answer format
 *  - Preparation of Trial Balance — Dr/Cr balance list is the answer
 */
const PINNED_TOPICS_BY_SUBJECT: Record<string, readonly string[]> = {
	"Financial Accounting Part 1": [
		"3efafa0f-ae6a-4e7d-a841-85e648ac4974", // The Ledger
		"19d8de1d-17ec-46b5-bcdf-28abe4225bd0", // Preparation of Trial Balance
	],
};

const ADMIN_HEADERS = (): Record<string, string> => ({
	apikey: SERVICE_ROLE,
	Authorization: `Bearer ${SERVICE_ROLE}`,
});

const SKIP_REASON =
	!STUDENT_EMAIL ?
		"PLAYWRIGHT_USER_EMAIL not set"
	: !SUPABASE_URL ?
		"NEXT_PUBLIC_SUPABASE_URL not set"
	: !SERVICE_ROLE ?
		"SUPABASE_SERVICE_ROLE_KEY not set"
	:	null;

type TrackerRow = { id: string; subject_id: string; topic_id: string };
type SubjectRow = { id: string; name: string };

type SubjectPlan = {
	id: string;
	name: string;
	topicIds: string[];
};

type RunTiming = {
	subject: string;
	test_id: string | null;
	generation_ms: number | null;
	generation_seconds: number | null;
	grading_ms: number | null;
	grading_seconds: number | null;
	total_ms: number;
	total_seconds: number;
	error?: string;
};

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

async function resolveStudentUserId(
	request: import("@playwright/test").APIRequestContext,
): Promise<string> {
	// Prefer PLAYWRIGHT_STUDENT_USER_ID when set. We saw the auth admin endpoint
	// return different (paginated) results inside Playwright's APIRequestContext
	// vs a plain Node fetch — likely a baseURL / proxy difference. An explicit
	// UUID bypasses the lookup entirely and is what CI runs use anyway.
	const pinned = (process.env.PLAYWRIGHT_STUDENT_USER_ID ?? "").trim();
	if (pinned) {
		// Optional sanity: confirm a tracker exists for this UUID so a typo
		// fails fast rather than producing an empty plan downstream.
		const r = await request.get(
			`${SUPABASE_URL}/rest/v1/performance_tracker?student_id=eq.${encodeURIComponent(pinned)}&select=id&limit=1`,
			{ headers: { ...ADMIN_HEADERS(), Accept: "application/json" } },
		);
		expect(r.ok(), `pinned PLAYWRIGHT_STUDENT_USER_ID lookup ${r.status()}`).toBe(true);
		const rows = (await r.json()) as unknown[];
		expect(
			rows.length,
			`PLAYWRIGHT_STUDENT_USER_ID=${pinned} has no performance_tracker rows`,
		).toBeGreaterThan(0);
		return pinned;
	}

	// Fallback: paginate the admin users endpoint until we find the email.
	// `/auth/v1/admin/users?email=` does NOT filter — it paginates and ignores
	// the query string. Filter explicitly so the test pins to the configured
	// PLAYWRIGHT_USER_EMAIL even when the page order changes.
	const wanted = STUDENT_EMAIL.toLowerCase();
	for (let page = 1; page <= 20; page++) {
		const resp = await request.get(
			`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`,
			{ headers: ADMIN_HEADERS() },
		);
		expect(resp.ok(), `admin user list page ${page} failed: ${resp.status()}`).toBe(true);
		const body = (await resp.json()) as
			| { users?: Array<{ id: string; email?: string | null }> }
			| Array<{ id: string; email?: string | null }>;
		const list = Array.isArray(body) ? body : (body.users ?? []);
		const hit = list.find((u) => (u.email ?? "").toLowerCase() === wanted);
		if (hit) return hit.id;
		if (list.length === 0) break;
	}
	throw new Error(`no auth.users row for ${STUDENT_EMAIL}`);
}

async function loadTargetSubjects(
	request: import("@playwright/test").APIRequestContext,
	userId: string,
): Promise<SubjectPlan[]> {
	const tr = await request.get(
		`${SUPABASE_URL}/rest/v1/performance_tracker?student_id=eq.${encodeURIComponent(userId)}&select=id,subject_id,topic_id`,
		{ headers: { ...ADMIN_HEADERS(), Accept: "application/json" } },
	);
	expect(tr.ok(), `performance_tracker fetch ${tr.status()}`).toBe(true);
	const trackers = (await tr.json()) as TrackerRow[];

	const subjectIds = [...new Set(trackers.map((t) => t.subject_id))];
	const sr = await request.get(
		`${SUPABASE_URL}/rest/v1/subjects?id=in.(${subjectIds.join(",")})&select=id,name`,
		{ headers: { ...ADMIN_HEADERS(), Accept: "application/json" } },
	);
	expect(sr.ok(), `subjects fetch ${sr.status()}`).toBe(true);
	const subjects = (await sr.json()) as SubjectRow[];

	const out: SubjectPlan[] = [];
	for (const name of TARGET_SUBJECTS) {
		const subj = subjects.find((s) => s.name === name);
		expect(subj, `subject ${name} must be on student's tracker`).toBeTruthy();
		const topicIds = [...new Set(trackers.filter((t) => t.subject_id === subj!.id).map((t) => t.topic_id))];
		expect(topicIds.length, `subject ${name} must have at least one tracker topic`).toBeGreaterThan(0);
		out.push({ id: subj!.id, name: subj!.name, topicIds });
	}
	return out;
}

async function fetchUniqueTopicLabels(
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
	const easy = page.locator("#diff-easy");
	if (await easy.isVisible().catch(() => false)) await easy.check();
}

async function answerCurrentQuestionBestEffort(
	page: import("@playwright/test").Page,
	correctMcqLetter?: string | null,
): Promise<boolean> {
	const mcqGroup = page.locator("fieldset").filter({ hasText: "Select an answer" });
	const mcqFirst = mcqGroup.locator('input[type="radio"]').first();
	if (await mcqFirst.isVisible().catch(() => false)) {
		// If we know the correct letter, click that index (A=0, B=1, C=2, D=3).
		// Radios render in alphabetical order in question-card.tsx.
		if (correctMcqLetter && /^[A-D]$/.test(correctMcqLetter)) {
			const idx = correctMcqLetter.charCodeAt(0) - "A".charCodeAt(0);
			await mcqGroup.locator('input[type="radio"]').nth(idx).check();
		} else {
			await mcqFirst.check();
		}
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

type AnswerKeyRow = {
	question_number: number;
	question_type: string;
	answer_key: { correct_answer?: string } | null;
};

/**
 * Pre-fetches answer keys for all questions in a generated test so the
 * Playwright run can pick the correct MCQ option per question. Returns an
 * array indexed by question_number-1 (i.e. result[0] is question 1). Each
 * entry's `correct_answer` is the MCQ letter (A/B/C/D) for MCQ questions,
 * null for non-MCQ (the test falls back to dummy text answers for those).
 */
async function fetchAnswerKeys(
	request: import("@playwright/test").APIRequestContext,
	testId: string,
): Promise<Array<{ correct_answer: string | null; question_type: string }>> {
	const r = await request.get(
		`${SUPABASE_URL}/rest/v1/questions?test_id=eq.${encodeURIComponent(testId)}&select=question_number,question_type,answer_key&order=question_number.asc`,
		{ headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
	);
	expect(r.ok(), `fetchAnswerKeys ${r.status()}`).toBeTruthy();
	const rows = (await r.json()) as AnswerKeyRow[];
	return rows.map((row) => ({
		question_type: row.question_type,
		correct_answer:
			row.question_type === "multiple_choice" ?
				(row.answer_key?.correct_answer?.trim() ?? null)
			:	null,
	}));
}

async function runOneSubject(
	page: import("@playwright/test").Page,
	request: import("@playwright/test").APIRequestContext,
	subj: SubjectPlan,
): Promise<RunTiming> {
	const totalStart = Date.now();
	const result: RunTiming = {
		subject: subj.name,
		test_id: null,
		generation_ms: null,
		generation_seconds: null,
		grading_ms: null,
		grading_seconds: null,
		total_ms: 0,
		total_seconds: 0,
	};

	try {
		// Avoid duplicate-label topics (same as practice-full-subjects.spec.ts).
		const labelMap = await fetchUniqueTopicLabels(request, subj.topicIds);
		const labelCounts = new Map<string, number>();
		for (const id of subj.topicIds) {
			const lbl = labelMap.get(id) ?? id;
			labelCounts.set(lbl, (labelCounts.get(lbl) ?? 0) + 1);
		}
		const usableIds = subj.topicIds.filter(
			(id) => (labelCounts.get(labelMap.get(id) ?? id) ?? 0) === 1,
		);

		// Pinned-topic override: when PINNED_TOPICS_BY_SUBJECT has an entry for
		// this subject, use ONLY those topic_ids (intersected with the tracker
		// pool so a stale pin doesn't break the test). Otherwise fall back to
		// the legacy "shuffle and pick 2" path.
		const pinned = PINNED_TOPICS_BY_SUBJECT[subj.name];
		const trackerSet = new Set(subj.topicIds);
		const picked = pinned
			? pinned.filter((id) => trackerSet.has(id))
			: shuffle(usableIds.length > 0 ? usableIds : subj.topicIds).slice(0, 2);
		if (pinned) {
			expect(picked.length, `pinned topics for ${subj.name} must all exist on tracker`).toBe(
				pinned.length,
			);
		}
		const pickedLabels = picked.map((id) => labelMap.get(id) ?? id);

		// --- Wizard up to "Generate" button ---
		await page.goto("/student/practice");
		await expect(page.getByRole("heading", { name: /^Practice$/i })).toBeVisible({
			timeout: 45_000,
		});
		await page
			.locator('button[type="button"]')
			.filter({ has: page.getByText(subj.name, { exact: true }) })
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

		for (const lbl of pickedLabels) {
			const cb = page
				.getByRole("checkbox", {
					name: new RegExp(`^Select\\s+${regexEscape(lbl)}\\s*$`, "i"),
				})
				.first();
			await expect(cb).toBeVisible({ timeout: 60_000 });
			await cb.check();
		}

		await page.getByRole("button", { name: /^Continue$/i }).click();
		await pickEasyDifficulty(page);
		await page.getByRole("button", { name: /Save configuration/i }).click();
		await expect(page.getByText(/Ready to generate/i)).toBeVisible({ timeout: 60_000 });

		// --- TIMED: Generation ---
		const genStart = Date.now();
		await page.getByRole("button", { name: /Generate practice test/i }).click();
		const readyDialog = page.getByRole("dialog", { name: /Your test is ready/i });
		const somethingWrong = page.getByRole("alert").filter({ hasText: /Something went wrong/i });
		const checkStep = page.getByRole("alert").filter({ hasText: /Check this step/i });
		// 25 min wait — DeepSeek + visual-enrichment retries can push past 10 min
		// even at low reasoning effort. Conservative so the suite finishes even
		// when one generation lands on a slow shard.
		await expect(readyDialog.or(somethingWrong).or(checkStep).first()).toBeVisible({
			timeout: 1_500_000,
		});
		if (await somethingWrong.first().isVisible().catch(() => false)) {
			const t = await somethingWrong.first().innerText().catch(() => "");
			throw new Error(`Generation pipeline error: ${t.slice(0, 600)}`);
		}
		if (await checkStep.first().isVisible().catch(() => false)) {
			const t = await checkStep.first().innerText().catch(() => "");
			throw new Error(`Wizard validation error: ${t.slice(0, 600)}`);
		}
		await expect(readyDialog).toBeVisible({ timeout: 10_000 });
		result.generation_ms = Date.now() - genStart;
		result.generation_seconds = Number((result.generation_ms / 1000).toFixed(2));

		// --- Start test, capture id ---
		await page.getByRole("button", { name: /^Start test$/i }).click();
		await page.waitForURL(/\/student\/practice\/[0-9a-f-]{36}/i, { timeout: 45_000 });
		const m = page.url().match(/\/student\/practice\/([0-9a-f-]{36})/i);
		const testId = m?.[1] ?? null;
		expect(testId, `test id from URL for ${subj.name}`).toBeTruthy();
		result.test_id = testId;

		// Walk all 15 questions so MCQ-only correctness logic gets to see every
		// MCQ slot — the question_number order is round-robin (MCQ → FIB → SA →
		// LA → MCQ → ...), so the 5 MCQs are spread across the test, not the
		// first 5 slots. Don't break on a non-MCQ failure (e.g. tiptap not
		// hydrated yet) — just advance to the next slot so subsequent MCQs
		// still get their correct option clicked.
		await expect(page.getByRole("button", { name: /Submit test/i }).first()).toBeVisible({
			timeout: 120_000,
		});
		const answerKeys = await fetchAnswerKeys(request, testId!);
		for (let i = 0; i < answerKeys.length; i++) {
			const correctLetter = answerKeys[i]?.correct_answer ?? null;
			await answerCurrentQuestionBestEffort(page, correctLetter).catch(() => false);
			const next = page.getByRole("button", { name: /^Next$/i });
			// Last question won't have a Next button — submit handles that.
			if ((await next.isVisible().catch(() => false)) && (await next.isEnabled().catch(() => false))) {
				await next.click();
				// Wait for the question card to advance. The card uses
				// `key={active.id}` so React re-mounts it; a brief settle works.
				await page.waitForTimeout(300);
			}
		}

		// --- TIMED: Grading ---
		const gradeStart = Date.now();
		await page.getByRole("button", { name: /^Submit test$/i }).first().click();
		await page.getByRole("dialog").getByRole("button", { name: /^Submit test$/i }).click();
		// Wait until we land on /student/reports AND the row for this test is visible.
		await page.waitForURL(
			(u) =>
				u.pathname.startsWith("/student/reports") ||
				(testId !== null && u.pathname.endsWith(`/student/practice/${testId}/grading`)),
			{ timeout: 540_000 },
		);
		if (!/^\/student\/reports/.test(new URL(page.url()).pathname)) {
			await page.waitForURL((u) => u.pathname.startsWith("/student/reports"), {
				timeout: 540_000,
			});
		}
		const safeId = testId!.replace(/[^0-9a-f-]/gi, "");
		await expect(page.locator(`#report-row-${safeId}`)).toBeVisible({ timeout: 300_000 });
		result.grading_ms = Date.now() - gradeStart;
		result.grading_seconds = Number((result.grading_ms / 1000).toFixed(2));
	} catch (e) {
		result.error = e instanceof Error ? e.message : String(e);
	}

	result.total_ms = Date.now() - totalStart;
	result.total_seconds = Number((result.total_ms / 1000).toFixed(2));
	return result;
}

test.describe.serial("DeepSeek timing — 3 core subjects (non-English)", () => {
	test.skip(SKIP_REASON !== null, SKIP_REASON ?? "");

	let userId!: string;
	let plans: SubjectPlan[] = [];
	const timings: RunTiming[] = [];

	test.beforeAll(async ({ request }) => {
		userId = await resolveStudentUserId(request);
		plans = await loadTargetSubjects(request, userId);
		console.log(
			`[deepseek-timing] student=${userId} subjects=${plans.map((p) => p.name).join(", ")}`,
		);
	});

	test.afterAll(async ({}, testInfo) => {
		// Markdown summary attached to the Playwright report + emitted to stdout
		// so the wrapping shell script can capture it.
		const lines: string[] = [];
		lines.push("# DeepSeek V4 Pro — Practice E2E timing");
		lines.push("");
		lines.push("| Subject | Generation (s) | Grading (s) | Total (s) | test_id | Error |");
		lines.push("|---|---:|---:|---:|---|---|");
		for (const t of timings) {
			lines.push(
				`| ${t.subject} | ${t.generation_seconds ?? "—"} | ${t.grading_seconds ?? "—"} | ${t.total_seconds} | ${t.test_id ?? "—"} | ${t.error ? t.error.slice(0, 80) : ""} |`,
			);
		}
		const okGens = timings.filter((t) => t.generation_ms !== null).map((t) => t.generation_ms!);
		const okGrades = timings.filter((t) => t.grading_ms !== null).map((t) => t.grading_ms!);
		if (okGens.length) {
			const avgGen = okGens.reduce((s, x) => s + x, 0) / okGens.length;
			const avgGrade = okGrades.length
				? okGrades.reduce((s, x) => s + x, 0) / okGrades.length
				: 0;
			lines.push("");
			lines.push(`**Avg generation:** ${(avgGen / 1000).toFixed(2)}s`);
			lines.push(`**Avg grading:** ${(avgGrade / 1000).toFixed(2)}s`);
		}
		const md = lines.join("\n");
		await testInfo.attach("deepseek-timing-summary.md", {
			body: Buffer.from(md),
			contentType: "text/markdown",
		});
		console.log("\n" + md);
	});

	// DEEPSEEK_TIMING_SUBJECT_CAP lets us run a subset (e.g. =2 for the hybrid
	// comparison, just Physics + Chemistry). Defaults to all 3.
	const subjectCap = (() => {
		const raw = process.env.DEEPSEEK_TIMING_SUBJECT_CAP?.trim();
		const n = raw ? Number.parseInt(raw, 10) : NaN;
		return Number.isFinite(n) && n > 0 ? Math.min(n, 3) : 3;
	})();

	for (const idx of [0, 1, 2].slice(0, subjectCap)) {
		test(`subject ${idx + 1}/${subjectCap}`, async ({ page, request }) => {
			test.setTimeout(60 * 60 * 1000);
			const subj = plans[idx]!;
			const t = await runOneSubject(page, request, subj);
			timings.push(t);
			console.log(
				`[deepseek-timing] ${subj.name}: gen=${t.generation_seconds ?? "—"}s grade=${t.grading_seconds ?? "—"}s total=${t.total_seconds}s${t.error ? ` ERROR=${t.error}` : ""}`,
			);
			expect(t.error, `subject ${subj.name} should not error`).toBeFalsy();
			expect(t.generation_ms, "generation must complete").not.toBeNull();
			expect(t.grading_ms, "grading must complete").not.toBeNull();
		});
	}
});
