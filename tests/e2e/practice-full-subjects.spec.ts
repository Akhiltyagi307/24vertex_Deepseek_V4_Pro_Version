import { expect, test } from "@playwright/test";

/**
 * Full practice E2E: one Playwright test per subject (serial). Each run picks
 * random topics (UI), generates, answers a subset, submits, waits for graded
 * report row, verifies test_reports via REST, and performance_tracker deltas.
 *
 * Env (student project — uses auth.setup session):
 * - PLAYWRIGHT_USER_EMAIL + PLAYWRIGHT_USER_PASSWORD
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 * - PLAYWRIGHT_STUDENT_USER_ID — must equal auth student UUID
 * - PLAYWRIGHT_PRACTICE_E2E_SUBJECT_CAP — positive int: only first N subjects
 * - PLAYWRIGHT_PRACTICE_E2E_MAX_SLOTS — max test slots registered (default 32)
 */

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const STUDENT_EMAIL = (
	process.env.PLAYWRIGHT_USER_EMAIL ??
	process.env["playwright_user_email"] ??
	""
).trim();
const OPTIONAL_USER_ID = (process.env.PLAYWRIGHT_STUDENT_USER_ID ?? "").trim();

const MAX_SUBJECT_SLOTS = Math.min(
	Math.max(1, Number.parseInt(process.env.PLAYWRIGHT_PRACTICE_E2E_MAX_SLOTS ?? "32", 10) || 32),
	48,
);

const ADMIN_HEADERS = (): Record<string, string> => ({
	apikey: SERVICE_ROLE,
	Authorization: `Bearer ${SERVICE_ROLE}`,
});

type TrackerRowDb = {
	id: string;
	subject_id: string;
	topic_id: string;
	tests_taken: number | null;
	updated_at: string | null;
};

type SubjectBrief = {
	id: string;
	name: string;
	sort_order: number | null;
};

type SubjectTopicsPlan = SubjectBrief & { trackers: TrackerRowDb[] };

const SKIP_REASON =
	!STUDENT_EMAIL ?
		"PLAYWRIGHT_USER_EMAIL not set"
	: !SUPABASE_URL ?
		"NEXT_PUBLIC_SUPABASE_URL not set"
	: !SERVICE_ROLE ?
		"SUPABASE_SERVICE_ROLE_KEY not set"
	:	null;

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function shuffle<T>(xs: readonly T[]): T[] {
	const a = [...xs];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j]!, a[i]!];
	}
	return a;
}

function subjectRunCap(): number | null {
	const raw = process.env.PLAYWRIGHT_PRACTICE_E2E_SUBJECT_CAP?.trim();
	if (!raw) return null;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n > 0 ? n : null;
}

function randomIntInclusive(min: number, max: number): number {
	if (max <= min) return min;
	return min + Math.floor(Math.random() * (max - min + 1));
}

async function resolveStudentUserId(request: import("@playwright/test").APIRequestContext): Promise<string> {
	const userResp = await request.get(
		`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(STUDENT_EMAIL)}`,
		{ headers: ADMIN_HEADERS() },
	);
	expect(userResp.ok(), `admin user lookup failed: ${userResp.status()}`).toBe(true);
	const userBody = (await userResp.json()) as { users?: Array<{ id: string }> } | Array<{ id: string }>;
	const userId =
		Array.isArray(userBody) ?
			userBody[0]?.id
		:	(userBody.users ?? [])[0]?.id;
	expect(userId, `no auth.users row for ${STUDENT_EMAIL}`).toBeTruthy();

	if (OPTIONAL_USER_ID) {
		expect(
			userId === OPTIONAL_USER_ID,
			`PLAYWRIGHT_STUDENT_USER_ID (${OPTIONAL_USER_ID}) must resolve to the same UUID as PLAYWRIGHT_USER_EMAIL (${userId})`,
		).toBe(true);
		expect(OPTIONAL_USER_ID, "PLAYWRIGHT_STUDENT_USER_ID must be UUID").toMatch(UUID_RE);
	}
	return userId!;
}

async function loadSubjectsWithTrackers(
	request: import("@playwright/test").APIRequestContext,
	userId: string,
): Promise<SubjectTopicsPlan[]> {
	const trackerResp = await request.get(
		`${SUPABASE_URL}/rest/v1/performance_tracker?student_id=eq.${encodeURIComponent(userId)}&select=id,subject_id,topic_id,tests_taken,updated_at`,
		{ headers: { ...ADMIN_HEADERS(), Accept: "application/json" } },
	);
	expect(trackerResp.ok(), `performance_tracker fetch failed: ${trackerResp.status()}`).toBe(true);
	const trackers = (await trackerResp.json()) as TrackerRowDb[];
	expect(trackers.length, `student has no performance_tracker rows`).toBeGreaterThan(0);

	const subjectIds = [...new Set(trackers.map((t) => t.subject_id))];
	const inList = subjectIds.join(",");
	const subResp = await request.get(
		`${SUPABASE_URL}/rest/v1/subjects?id=in.(${inList})&select=id,name,sort_order`,
		{ headers: { ...ADMIN_HEADERS(), Accept: "application/json" } },
	);
	expect(subResp.ok(), `subjects fetch failed ${subResp.status()}`).toBe(true);
	const subjects = (await subResp.json()) as SubjectBrief[];
	const nameBySubject = new Map(subjects.map((s) => [s.id, s]));

	const rows: SubjectTopicsPlan[] = [];
	for (const sid of subjectIds) {
		const meta = nameBySubject.get(sid);
		if (!meta) continue;
		const subTrackers = trackers.filter((t) => t.subject_id === sid);
		rows.push({ ...meta, trackers: subTrackers });
	}
	expect(rows.length, "at least one subject with tracker rows").toBeGreaterThan(0);
	rows.sort((a, b) => {
		const ao = a.sort_order ?? 999;
		const bo = b.sort_order ?? 999;
		if (ao !== bo) return ao - bo;
		return a.name.localeCompare(b.name);
	});
	return rows;
}

async function fetchTopicSnapshots(
	request: import("@playwright/test").APIRequestContext,
	userId: string,
	topicIds: string[],
): Promise<Map<string, { tests_taken: number; updated_at_iso: string }>> {
	const inList = topicIds.map((id) => encodeURIComponent(id)).join(",");
	const r = await request.get(
		`${SUPABASE_URL}/rest/v1/performance_tracker?student_id=eq.${encodeURIComponent(userId)}&topic_id=in.(${inList})&select=topic_id,tests_taken,updated_at`,
		{ headers: { ...ADMIN_HEADERS(), Accept: "application/json" } },
	);
	expect(r.ok(), `tracker snapshot failed ${r.status()}`).toBe(true);
	const rows = (await r.json()) as {
		topic_id: string;
		tests_taken: number | null;
		updated_at: string | null;
	}[];
	const map = new Map<string, { tests_taken: number; updated_at_iso: string }>();
	for (const row of rows) {
		map.set(row.topic_id, {
			tests_taken: Number(row.tests_taken ?? 0),
			updated_at_iso: (row.updated_at ?? new Date(0).toISOString()).trim(),
		});
	}
	return map;
}

function trackersAdvanced(
	before: Map<string, { tests_taken: number; updated_at_iso: string }>,
	after: Map<string, { tests_taken: number; updated_at_iso: string }>,
	topicIds: string[],
): { ok: boolean; details: string } {
	const parts: string[] = [];
	let okAll = true;
	for (const tid of topicIds) {
		const b = before.get(tid);
		const a = after.get(tid);
		if (!b || !a) {
			okAll = false;
			parts.push(`${tid}: missing before(${Boolean(b)}) or after(${Boolean(a)}) row`);
			continue;
		}
		const bumped = a.tests_taken > b.tests_taken || Date.parse(a.updated_at_iso) > Date.parse(b.updated_at_iso);
		if (!bumped) {
			okAll = false;
			parts.push(
				`${tid}: tests_taken ${b.tests_taken}->${a.tests_taken}, updated_at ${b.updated_at_iso} -> ${a.updated_at_iso} (unchanged signal)`,
			);
		} else {
			parts.push(
				`${tid}: tests_taken ${b.tests_taken}->${a.tests_taken}; updated refreshed=${Date.parse(a.updated_at_iso) > Date.parse(b.updated_at_iso)}`,
			);
		}
	}
	return { ok: okAll, details: parts.join("; ") };
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

async function waitForTrackerBump(
	request: import("@playwright/test").APIRequestContext,
	userId: string,
	topicIds: string[],
	before: Map<string, { tests_taken: number; updated_at_iso: string }>,
	maxWaitMs: number,
): Promise<{ ok: boolean; details: string }> {
	const deadline = Date.now() + maxWaitMs;
	while (Date.now() < deadline) {
		const after = await fetchTopicSnapshots(request, userId, topicIds);
		const adv = trackersAdvanced(before, after, topicIds);
		if (adv.ok) return { ok: true, details: adv.details };
		await new Promise((r) => setTimeout(r, 5_000));
	}
	const after = await fetchTopicSnapshots(request, userId, topicIds);
	const adv = trackersAdvanced(before, after, topicIds);
	return { ok: adv.ok, details: adv.details };
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

async function waitForReportsRow(page: import("@playwright/test").Page, testId: string, timeoutMs: number) {
	const safeId = testId.replace(/[^0-9a-f-]/gi, "");
	const row = page.locator(`#report-row-${safeId}`);
	await expect(row).toBeVisible({ timeout: timeoutMs });
}

async function pickEasyDifficulty(page: import("@playwright/test").Page) {
	const easyRadio = page.locator("#diff-easy");
	if (await easyRadio.isVisible().catch(() => false)) await easyRadio.check();
}

async function answerCurrentQuestionBestEffort(page: import("@playwright/test").Page): Promise<boolean> {
	const mcq = page.locator("fieldset").filter({ hasText: "Select an answer" }).locator('input[type="radio"]').first();
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

function regexEscape(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wait for generation overlay ready dialog or a blocking error alert on the wizard. */
async function waitForGenerationOutcome(page: import("@playwright/test").Page, timeoutMs: number): Promise<void> {
	const readyDialog = page.getByRole("dialog", { name: /Your test is ready/i });
	const somethingWrong = page.getByRole("alert").filter({ hasText: /Something went wrong/i });
	const checkStep = page.getByRole("alert").filter({ hasText: /Check this step/i });

	const winner = readyDialog.or(somethingWrong).or(checkStep);
	await expect(winner.first()).toBeVisible({ timeout: timeoutMs });

	if (await somethingWrong.first().isVisible().catch(() => false)) {
		const text = await somethingWrong.first().innerText().catch(() => "");
		throw new Error(`Practice pipeline surfaced error alert: ${text.slice(0, 800)}`);
	}
	if (await checkStep.first().isVisible().catch(() => false)) {
		const text = await checkStep.first().innerText().catch(() => "");
		throw new Error(`Practice wizard validation/draft error: ${text.slice(0, 800)}`);
	}

	await expect(readyDialog).toBeVisible({ timeout: 10_000 });
}

type SubjectRunSummary = {
	subject_name: string;
	subject_id: string;
	slot_index: number;
	topic_ids: string[];
	topic_labels: string[];
	test_id: string;
	elapsed_seconds: number;
	warnings: string[];
};

async function runSingleSubjectPracticeFlow(
	page: import("@playwright/test").Page,
	request: import("@playwright/test").APIRequestContext,
	testInfo: import("@playwright/test").TestInfo,
	userId: string,
	subj: SubjectTopicsPlan,
	slotIndex: number,
): Promise<SubjectRunSummary> {
	const warns: string[] = [];
	const tWall0 = Date.now();

	console.log(`[practice-full-subjects] ▶ SLOT ${slotIndex + 1} — ${subj.name} (${subj.id})`);

	const allTopicIds = [...new Set(subj.trackers.map((p) => p.topic_id))];
	const allLabelMap = await fetchTopicLabels(request, allTopicIds);
	const labelCounts = new Map<string, number>();
	for (const id of allTopicIds) {
		const label = allLabelMap.get(id) ?? id;
		labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
	}
	const selectableTrackers = subj.trackers.filter((tracker) => {
		const label = allLabelMap.get(tracker.topic_id) ?? tracker.topic_id;
		return (labelCounts.get(label) ?? 0) === 1;
	});
	const trackerPool = selectableTrackers.length > 0 ? selectableTrackers : subj.trackers;
	if (selectableTrackers.length < subj.trackers.length) {
		warns.push(`Skipped ${subj.trackers.length - selectableTrackers.length} ambiguous duplicate-label topics.`);
	}

	const shuffled = shuffle(trackerPool);
	const nPick = randomIntInclusive(1, Math.min(4, shuffled.length));
	const picked = shuffled.slice(0, nPick);
	const topicIds = [...new Set(picked.map((p) => p.topic_id))];
	const trackerIds = [...new Set(picked.map((p) => p.id))];

	const pickedTopicLabels = topicIds.map((id) => allLabelMap.get(id) ?? id);

	const beforeMap = await fetchTopicSnapshots(request, userId, topicIds);

	let testId: string | null = null;

	await test.step(`${subj.name}: wizard → generate → session`, async () => {
		await page.goto("/student/practice");
		await expect(page.getByRole("heading", { name: /^Practice$/i })).toBeVisible({ timeout: 45_000 });

		await page
			.locator('button[type="button"]')
			.filter({ has: page.getByText(subj.name, { exact: true }) })
			.first()
			.click();

		const step0Continue = page.getByRole("button", { name: /^Continue$/i }).first();
		await expect(step0Continue).toBeEnabled({ timeout: 15_000 });
		await step0Continue.click();

		await expect(page.getByRole("heading", { name: /^Topics$/i })).toBeVisible({ timeout: 30_000 });
		await page.getByRole("button", { name: "Clear", exact: true }).click({ timeout: 8_000 }).catch(() => {});
		await page.getByRole("button", { name: "Expand all" }).click({ timeout: 10_000 });

		for (const label of pickedTopicLabels) {
			const cb = page.getByRole("checkbox", {
				name: new RegExp(`^Select\\s+${regexEscape(label)}\\s*$`, "i"),
			}).first();
			await expect(cb).toBeVisible({ timeout: 60_000 });
			await cb.check();
		}

		await page.getByRole("button", { name: /^Continue$/i }).click();
		await pickEasyDifficulty(page);
		await page.getByRole("button", { name: /Save configuration/i }).click();
		await expect(page.getByText(/Ready to generate/i)).toBeVisible({ timeout: 60_000 });
		await page.getByRole("button", { name: /Generate practice test/i }).click();

		await waitForGenerationOutcome(page, 450_000);

		await page.getByRole("button", { name: /^Start test$/i }).click();
		await page.waitForURL(/\/student\/practice\/[0-9a-f-]{36}/i, { timeout: 45_000 });
		const m = page.url().match(/\/student\/practice\/([0-9a-f-]{36})/i);
		testId = m?.[1] ?? null;
		expect(testId, "capture test UUID from URL").toBeTruthy();
	});

	await testInfo.attach(`${String(slotIndex + 1).padStart(2, "0")}-${subj.name.slice(0, 40)}-selection.json`, {
		body: Buffer.from(
			JSON.stringify(
				{
					slot: slotIndex + 1,
					subjectId: subj.id,
					subjectName: subj.name,
					topic_ids: topicIds,
					topic_labels: pickedTopicLabels,
					tracker_ids: trackerIds,
					test_id: testId,
				},
				null,
				2,
			),
		),
		contentType: "application/json",
	});

	await test.step(`${subj.name}: answer & submit`, async () => {
		await expect(page.getByRole("button", { name: /Submit test/i }).first()).toBeVisible({ timeout: 90_000 });
		const answered = 5;
		for (let qi = 0; qi < answered; qi++) {
			const okAns = await answerCurrentQuestionBestEffort(page);
			if (!okAns) {
				warns.push(`Could not derive answer control at question iteration ${qi} — stopping early`);
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
	});

	await test.step(`${subj.name}: grading → reports`, async () => {
		await page.waitForURL(
			(u) => {
				const onGrading =
					testId !== null && u.pathname.endsWith(`/student/practice/${testId}/grading`);
				const onReports = u.pathname.startsWith("/student/reports");
				return onGrading || onReports;
			},
			{ timeout: 540_000 },
		);

		if (!/^\/student\/reports/.test(new URL(page.url()).pathname)) {
			await page.waitForURL((u) => u.pathname.startsWith("/student/reports"), { timeout: 540_000 });
		}

		await waitForReportsRow(page, testId!, 300_000);
	});

	const rowPoll = await pollReportReady(request, testId!, 240_000);
	expect(rowPoll.ok, "test_reports row must exist after graded UI (REST poll)").toBe(true);
	if (rowPoll.grading_error)
		warns.push(`test_reports.grading_error: ${String(rowPoll.grading_error)}`);

	const trackerWait = await waitForTrackerBump(request, userId, topicIds, beforeMap, 180_000);
	expect(trackerWait.ok, `performance_tracker did not advance: ${trackerWait.details}`).toBe(true);

	const elapsed = Number(((Date.now() - tWall0) / 1000).toFixed(1));

	const summary: SubjectRunSummary = {
		subject_name: subj.name,
		subject_id: subj.id,
		slot_index: slotIndex,
		topic_ids: topicIds,
		topic_labels: pickedTopicLabels,
		test_id: testId!,
		elapsed_seconds: elapsed,
		warnings: warns,
	};

	testInfo.annotations.push({
		type: `practice_subject_slot_${slotIndex + 1}`,
		description: JSON.stringify(summary),
	});

	console.log(
		`[practice-full-subjects] ◀ SLOT ${slotIndex + 1} OK (${elapsed}s) test_id=${testId} warns=${warns.length}`,
	);

	return summary;
}

test.describe.serial("Practice full flow — one test per subject", () => {
	test.skip(SKIP_REASON !== null, SKIP_REASON ?? "");

	let userId!: string;
	let subjectsToRunSnap: SubjectTopicsPlan[] = [];

	test.beforeAll(async ({ request }) => {
		userId = await resolveStudentUserId(request);
		const subjects = await loadSubjectsWithTrackers(request, userId);
		const cap = subjectRunCap();
		subjectsToRunSnap = cap != null ? subjects.slice(0, cap) : subjects;
		if (cap != null && cap < subjects.length) {
			console.log(
				`[practice-full-subjects] PLAYWRIGHT_PRACTICE_E2E_SUBJECT_CAP=${cap}: running ${subjectsToRunSnap.length}/${subjects.length} subjects`,
			);
		}
		console.log(
			`[practice-full-subjects] student=${userId} subjects=${subjectsToRunSnap.length} slots≤${MAX_SUBJECT_SLOTS}`,
			subjectsToRunSnap.map((s) => `${s.name} (${s.trackers.length} topics)`).join("; "),
		);

		expect(
			subjectsToRunSnap.length,
			`Increase PLAYWRIGHT_PRACTICE_E2E_MAX_SLOTS (now ${MAX_SUBJECT_SLOTS}); student has ${subjectsToRunSnap.length} tracker-backed subjects.`,
		).toBeLessThanOrEqual(MAX_SUBJECT_SLOTS);
	});

	for (let slot = 0; slot < MAX_SUBJECT_SLOTS; slot++) {
		const idx = slot;
		test(`Practice · slot ${idx + 1} of ≤${MAX_SUBJECT_SLOTS}`, async ({ page, request }, testInfo) => {
			test.setTimeout(60 * 60 * 1000);
			const subj = subjectsToRunSnap[idx];
			test.skip(
				subj === undefined,
				idx === 0 ?
					"No subjects resolved in beforeAll (unexpected)"
				:	"No subject at this slot (shorter tracker-backed subject list)",
			);

			await runSingleSubjectPracticeFlow(page, request, testInfo, userId, subj!, idx);
		});
	}
});
