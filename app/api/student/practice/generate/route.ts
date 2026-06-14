import { requireApiStudent } from "@/lib/auth/api-request-user";
import { triggerPracticeWorkerInBackground } from "@/lib/admin/practice-worker-trigger";
import { httpStatusForGenerateFailure } from "@/lib/practice/generate-stream-envelope";
import { preflightPracticeGeneration, safeParseGenerationInput } from "@/lib/practice/practice-generation-pipeline";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Durable, idempotent student-initiated generation (review H2, increment 2b).
 *
 * Unlike the streaming route (which runs the whole pipeline inside one request),
 * this enqueues a `student_generate_test` job and returns immediately; the worker
 * generates + persists + bills durably (survives the 300s ceiling / disconnect).
 * The client polls a progress endpoint (increment 3) by client_request_id.
 *
 * Idempotency: a retry carrying the same client_request_id resolves to the
 * already-generated test (tests pre-check) or the already-queued job (the
 * practice_jobs partial unique index -> 23505), so it never double-charges or
 * double-queues.
 *
 * Opt-in via PRACTICE_ASYNC_GENERATE until the polling UX (increment 3) ships;
 * inert otherwise.
 */
function isAsyncGenerateEnabled(): boolean {
	const raw = process.env.PRACTICE_ASYNC_GENERATE?.trim().toLowerCase();
	if (process.env.NODE_ENV !== "production") return true;
	return raw === "true";
}

export async function POST(request: Request) {
	if (!isAsyncGenerateEnabled()) {
		return Response.json({ success: false, code: "not_found", message: "Async generation disabled." }, { status: 404 });
	}

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return Response.json({ success: false, code: "validation_error", message: "Invalid JSON." }, { status: 400 });
	}

	const parsed = safeParseGenerationInput(json);
	if (!parsed.success) {
		return Response.json(
			{ success: false, code: "validation_error", message: "Validation error: invalid configuration." },
			{ status: 400 },
		);
	}

	const rawKey = (json as { clientRequestId?: unknown })?.clientRequestId;
	const clientRequestId = typeof rawKey === "string" && UUID_RE.test(rawKey) ? rawKey : crypto.randomUUID();

	const auth = await requireApiStudent(request);
	if (!auth.ok) {
		return Response.json(
			{ success: false, code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.message },
			{ status: auth.status },
		);
	}
	const { supabase, user } = auth;
	const admin = createServiceRoleClient();

	// Idempotency #1: already generated for this key -> return that test, no
	// re-charge, no new job.
	const { data: existingTest } = await admin
		.from("tests")
		.select("id")
		.eq("student_id", user.id)
		.eq("client_request_id", clientRequestId)
		.maybeSingle<{ id: string }>();
	if (existingTest?.id) {
		return Response.json({ ok: true, clientRequestId, testId: existingTest.id, alreadyGenerated: true });
	}

	// Gate: rate-limit + quota (no decrement; the worker consumes on generate).
	const gate = await preflightPracticeGeneration(supabase, parsed.data);
	if (!gate.ok) {
		const r = gate.result;
		if (r.ok) {
			return Response.json({ success: false, code: "internal_error", message: "Unexpected preflight state." }, { status: 500 });
		}
		const status = httpStatusForGenerateFailure(r);
		const headers: Record<string, string> = {};
		if (r.code === "rate_limited" && r.resetAt) {
			const secs = Math.max(0, Math.ceil((new Date(r.resetAt).getTime() - Date.now()) / 1000));
			headers["Retry-After"] = String(secs);
		}
		return Response.json(
			{
				success: false,
				code: r.code,
				message: r.message,
				...(r.paywall ? { paywall: true } : {}),
				...(r.correlationId ? { correlationId: r.correlationId } : {}),
				...(r.code === "rate_limited" ? { resetAt: r.resetAt ?? null } : {}),
			},
			{ status, headers },
		);
	}

	// Enqueue. The partial unique index dedups concurrent active jobs per
	// (student, key): a racing duplicate insert fails with 23505 and we report the
	// job as already queued rather than creating a second one.
	const { data: job, error: insertError } = await admin
		.from("practice_jobs")
		.insert({
			job_type: "student_generate_test",
			student_id: user.id,
			status: "pending",
			run_after: new Date().toISOString(),
			payload: { input: parsed.data, client_request_id: clientRequestId },
		})
		.select("id")
		.single<{ id: string }>();

	if (insertError) {
		if (insertError.code === "23505") {
			return Response.json({ ok: true, clientRequestId, deduped: true });
		}
		logSupabaseError("studentGenerateEnqueue.insert", insertError, { studentId: user.id });
		return Response.json({ success: false, code: "database_error", message: "Could not queue generation." }, { status: 500 });
	}

	// Best-effort fast start; pg_cron is the guarantee.
	void triggerPracticeWorkerInBackground();

	return Response.json({ ok: true, clientRequestId, jobId: job.id });
}
