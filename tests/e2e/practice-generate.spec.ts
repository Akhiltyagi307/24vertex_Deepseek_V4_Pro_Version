/**
 * Practice generation pipeline — exercises the prompt v4 / strict-schema /
 * retry-budget changes by asking the *real* OpenAI generation pipeline to
 * produce 3 practice tests for the seed student.
 *
 * What this proves:
 *   - System prompt rev v4 (HARD GATES → pedagogy → final compliance recap)
 *   - PRACTICE_STRICT_JSON_SCHEMA_GENERATE=on default
 * `PRACTICE_GENERATION_REPAIR_BUDGET` (default **3**) — validation/quality/dedup repairs only; no full regenerate retries.
 *   - The streaming envelope ends with a `done` line (not `error`)
 *
 * Why we hit /api/student/practice/generate-stream rather than walking the
 * wizard: the wizard renders subject/topic data only as React state (no
 * data-* attributes on the buttons), so a UI walk would couple the test to
 * subject names. Discovering `subjectId` + `trackerIds` from Supabase
 * directly is more robust and lets each `test()` be a self-contained
 * generation we can time independently.
 *
 * Cookies arrive via the `student` project's `storageState`, written by
 * `auth.setup.ts`. The route handler reuses the standard Supabase
 * `getApiRequestUser` path.
 *
 * Skipping rules:
 *   - `PLAYWRIGHT_USER_*` not set → no student to sign in as.
 *   - `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_URL` not set →
 *     can't look up the student's user_id or `performance_tracker` rows.
 *   - The student has 0 `performance_tracker` rows → can't satisfy
 *     `trackerIds` ≥ 1, generation would fail with `stale_selection`.
 */

import { expect, test } from "@playwright/test";

import { questionVisualEnvelopeSchema } from "@/lib/practice/visuals/schemas";
import { stemNeedsVisualHint } from "@/lib/practice/visuals/stem-visual-hints";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const STUDENT_EMAIL = (
	process.env.PLAYWRIGHT_USER_EMAIL ??
	process.env["playwright_user_email"] ??
	""
).trim();

const SKIP_REASON =
	!STUDENT_EMAIL ?
		"PLAYWRIGHT_USER_EMAIL not set"
	: !SUPABASE_URL ?
		"NEXT_PUBLIC_SUPABASE_URL not set"
	: !SERVICE_ROLE ?
		"SUPABASE_SERVICE_ROLE_KEY not set — required to discover trackerIds"
	:	null;

type TrackerRow = { id: string; subject_id: string; topic_id: string };

type GenerationContext = {
	subjectId: string;
	trackerIds: string[];
	userId: string;
};

let ctx: GenerationContext | null = null;

async function discoverGenerationContext(
	request: import("@playwright/test").APIRequestContext,
): Promise<GenerationContext> {
	const adminHeaders = {
		apikey: SERVICE_ROLE,
		Authorization: `Bearer ${SERVICE_ROLE}`,
	};

	// Supabase Admin: GET /auth/v1/admin/users?email=… returns { users: [...] }.
	const userResp = await request.get(
		`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(STUDENT_EMAIL)}`,
		{ headers: adminHeaders },
	);
	expect(userResp.ok(), `admin user lookup failed: ${userResp.status()}`).toBe(true);
	const userBody = (await userResp.json()) as
		| { users?: Array<{ id: string }> }
		| Array<{ id: string }>;
	const userId =
		Array.isArray(userBody) ?
			userBody[0]?.id
		:	(userBody.users ?? [])[0]?.id;
	expect(userId, `no auth.users row for ${STUDENT_EMAIL}`).toBeTruthy();

	// performance_tracker is the canonical source of `trackerIds` the wizard
	// passes through `finalizePracticeConfigSchema`. We pull a small batch
	// and pick the subject with the most trackers so we have ≥ 1 tracker
	// from a real enrollment.
	const trackerResp = await request.get(
		`${SUPABASE_URL}/rest/v1/performance_tracker?student_id=eq.${userId}&select=id,subject_id,topic_id&limit=20`,
		{ headers: adminHeaders },
	);
	expect(trackerResp.ok(), `performance_tracker fetch failed: ${trackerResp.status()}`).toBe(
		true,
	);
	const trackers = (await trackerResp.json()) as TrackerRow[];
	expect(
		trackers.length,
		`student ${STUDENT_EMAIL} has no performance_tracker rows; seed enrollment first`,
	).toBeGreaterThan(0);

	const bySubject = new Map<string, TrackerRow[]>();
	for (const t of trackers) {
		const bucket = bySubject.get(t.subject_id) ?? [];
		bucket.push(t);
		bySubject.set(t.subject_id, bucket);
	}
	const [topSubject, topTrackers] = [...bySubject.entries()].sort(
		(a, b) => b[1].length - a[1].length,
	)[0]!;
	const trackerIds = topTrackers.slice(0, Math.min(2, topTrackers.length)).map((t) => t.id);

	return { subjectId: topSubject, trackerIds, userId: userId as string };
}

type StreamEnvelope =
	| { type: "partial"; partial: unknown }
	| { type: "done"; result: { ok: true; testId: string; subjectName: string; questions: unknown[]; generation_metadata: unknown } }
	| { type: "error"; code?: string; message: string };

function assertVisualQualityWhenEnabled(questions: unknown[], tag: string): void {
	if (process.env.PRACTICE_VISUALS !== "true") return;

	const questionRecords = questions.filter(
		(question): question is Record<string, unknown> =>
			question != null && typeof question === "object" && !Array.isArray(question),
	);
	const visualQuestions = questionRecords.filter((question) => {
		const visual = (question.metadata as { visual?: unknown } | undefined)?.visual ?? question.visual;
		return visual != null;
	});
	const danglingVisualRefs = questionRecords.filter((question) => {
		const questionText = typeof question.question_text === "string" ? question.question_text : "";
		const visual = (question.metadata as { visual?: unknown } | undefined)?.visual ?? question.visual;
		return stemNeedsVisualHint(questionText) && visual == null;
	});

	expect(visualQuestions.length, `${tag}: PRACTICE_VISUALS=true should produce at least one visual`).toBeGreaterThan(0);
	expect(danglingVisualRefs, `${tag}: visual-referencing stems must include a visual`).toEqual([]);

	for (const question of visualQuestions) {
		const visual = (question.metadata as { visual?: unknown } | undefined)?.visual ?? question.visual;
		const parsed = questionVisualEnvelopeSchema.safeParse(visual);
		expect(parsed.success, `${tag}: visual envelope should match schema`).toBe(true);
	}
}

async function runOneGeneration(
	page: import("@playwright/test").Page,
	body: { subjectId: string; trackerIds: string[]; difficulty: "easy" | "medium" | "hard"; durationSeconds: 3600 | 10800 },
	tag: string,
) {
	const started = Date.now();
	// page.request inherits cookies from storageState — the same session the
	// streaming route's getApiRequestUser sees.
	const resp = await page.request.post(`/api/student/practice/generate-stream`, {
		data: body,
		timeout: 6 * 60 * 1000, // generous: AI + retries + repair, max 5 calls
	});
	const status = resp.status();
	const text = await resp.text();
	const elapsedMs = Date.now() - started;

	const lines = text.split("\n").filter(Boolean);
	const envelopes: StreamEnvelope[] = [];
	for (const line of lines) {
		try {
			envelopes.push(JSON.parse(line) as StreamEnvelope);
		} catch {
			// ignore non-JSON line (shouldn't happen with NDJSON, but be defensive)
		}
	}
	const last = envelopes.at(-1);
	const partials = envelopes.filter((e) => e.type === "partial").length;

	const summary = {
		tag,
		http_status: status,
		elapsed_seconds: Number((elapsedMs / 1000).toFixed(1)),
		partial_envelopes: partials,
		final_type: last?.type ?? "<none>",
		test_id: last?.type === "done" ? last.result.testId : null,
		question_count: last?.type === "done" ? last.result.questions.length : null,
		error_code: last?.type === "error" ? (last.code ?? null) : null,
		error_message: last?.type === "error" ? last.message : null,
	};
	test.info().annotations.push({ type: tag, description: JSON.stringify(summary) });
	console.log(`[practice-generate] ${tag}`, summary);

	expect(resp.ok(), `${tag}: HTTP ${status} (body: ${text.slice(0, 400)})`).toBe(true);
	if (!last) {
		throw new Error(`${tag}: stream emitted no envelopes`);
	}
	expect(
		last.type,
		`${tag}: expected final envelope type=done, got type=${last.type}` +
			(last.type === "error" ? ` code=${last.code} message=${last.message}` : ""),
	).toBe("done");
	if (last.type === "done") {
		expect(last.result.ok, `${tag}: result.ok`).toBe(true);
		expect(last.result.testId, `${tag}: testId UUID`).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
		expect(last.result.questions.length, `${tag}: must produce questions`).toBeGreaterThan(0);
		assertVisualQualityWhenEnabled(last.result.questions, tag);
	}
	return summary;
}

test.describe("Practice generation pipeline (3 sequential runs)", () => {
	test.skip(SKIP_REASON !== null, SKIP_REASON ?? "");
	// Each test owns its own AI call; serial keeps OpenAI rate limits sane.
	test.describe.configure({ mode: "serial" });

	test.beforeAll(async ({ request }) => {
		ctx = await discoverGenerationContext(request);
		console.log(
			`[practice-generate] discovered subjectId=${ctx.subjectId} trackerCount=${ctx.trackerIds.length}`,
		);
	});

	for (let i = 1; i <= 3; i++) {
		test(`generation #${i} returns done envelope with a testId`, async ({ page }) => {
			test.setTimeout(7 * 60 * 1000);
			expect(ctx, "discoverGenerationContext must populate ctx in beforeAll").toBeTruthy();
			await runOneGeneration(
				page,
				{
					subjectId: ctx!.subjectId,
					trackerIds: ctx!.trackerIds,
					difficulty: "easy",
					durationSeconds: 3600,
				},
				`gen_${i}`,
			);
		});
	}
});
