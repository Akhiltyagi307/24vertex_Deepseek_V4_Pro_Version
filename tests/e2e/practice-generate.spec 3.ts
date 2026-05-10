import { expect, test } from "@playwright/test";

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
		"SUPABASE_SERVICE_ROLE_KEY not set"
	:	null;

type TrackerRow = { id: string; subject_id: string };
type GenerationContext = { subjectId: string; trackerIds: string[] };
type StreamEnvelope =
	| { type: "partial"; partial: unknown }
	| { type: "done"; result: { ok: true; testId: string; questions: unknown[] } }
	| { type: "error"; code?: string; message: string; correlationId?: string };

let ctx: GenerationContext | null = null;

async function discoverGenerationContext(
	request: import("@playwright/test").APIRequestContext,
): Promise<GenerationContext> {
	const adminHeaders = {
		apikey: SERVICE_ROLE,
		Authorization: `Bearer ${SERVICE_ROLE}`,
	};

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

	const trackerResp = await request.get(
		`${SUPABASE_URL}/rest/v1/performance_tracker?student_id=eq.${userId}&select=id,subject_id&limit=20`,
		{ headers: adminHeaders },
	);
	expect(trackerResp.ok(), `performance_tracker fetch failed: ${trackerResp.status()}`).toBe(true);
	const trackers = (await trackerResp.json()) as TrackerRow[];
	expect(trackers.length, `student ${STUDENT_EMAIL} has no performance_tracker rows`).toBeGreaterThan(0);

	const bySubject = new Map<string, TrackerRow[]>();
	for (const t of trackers) {
		const bucket = bySubject.get(t.subject_id) ?? [];
		bucket.push(t);
		bySubject.set(t.subject_id, bucket);
	}
	const [subjectId, subjectTrackers] = [...bySubject.entries()].sort((a, b) => b[1].length - a[1].length)[0]!;
	const trackerIds = subjectTrackers.slice(0, Math.min(2, subjectTrackers.length)).map((t) => t.id);
	return { subjectId, trackerIds };
}

async function runOneGeneration(
	page: import("@playwright/test").Page,
	body: { subjectId: string; trackerIds: string[]; difficulty: "easy"; durationSeconds: 3600 },
	tag: string,
) {
	const started = Date.now();
	const resp = await page.request.post(`/api/student/practice/generate-stream`, {
		data: body,
		timeout: 6 * 60 * 1000,
	});
	const text = await resp.text();
	const elapsedMs = Date.now() - started;
	const envelopes: StreamEnvelope[] = text
		.split("\n")
		.filter(Boolean)
		.flatMap((line) => {
			try {
				return [JSON.parse(line) as StreamEnvelope];
			} catch {
				return [];
			}
		});
	const last = envelopes.at(-1);
	const summary = {
		tag,
		http_status: resp.status(),
		elapsed_seconds: Number((elapsedMs / 1000).toFixed(1)),
		final_type: last?.type ?? "<none>",
		test_id: last?.type === "done" ? last.result.testId : null,
		question_count: last?.type === "done" ? last.result.questions.length : null,
		error_code: last?.type === "error" ? (last.code ?? null) : null,
		correlation_id: last?.type === "error" ? (last.correlationId ?? null) : null,
	};
	test.info().annotations.push({ type: tag, description: JSON.stringify(summary) });
	console.log(`[practice-generate] ${tag}`, summary);

	expect(resp.ok(), `${tag}: HTTP ${resp.status()} (body: ${text.slice(0, 400)})`).toBe(true);
	expect(last, `${tag}: stream emitted no envelopes`).toBeDefined();
	expect(last?.type, `${tag}: expected final envelope type=done`).toBe("done");
	if (last?.type === "done") {
		expect(last.result.ok, `${tag}: result.ok`).toBe(true);
		expect(last.result.testId, `${tag}: testId UUID`).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
		expect(last.result.questions.length, `${tag}: must produce questions`).toBeGreaterThan(0);
	}
}

test.describe("Practice generation pipeline (2 sequential runs)", () => {
	test.skip(SKIP_REASON !== null, SKIP_REASON ?? "");
	test.describe.configure({ mode: "serial" });

	test.beforeAll(async ({ request }) => {
		ctx = await discoverGenerationContext(request);
		console.log(
			`[practice-generate] discovered subjectId=${ctx.subjectId} trackerCount=${ctx.trackerIds.length}`,
		);
	});

	for (let i = 1; i <= 2; i++) {
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
