import { getApiRequestUser } from "@/lib/auth/api-request-user";
import { BUCKET_INDEX, BUCKET_TOTAL, bucketForStepKey } from "@/lib/practice/generation-progress-buckets";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient, type ServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Progress poller for durable student-initiated generation (review H2, increment
 * 3). The wizard polls this by client_request_id after enqueuing. Returns the
 * coarse job state plus the highest completed checklist bucket (derived from the
 * generation run linked via correlation_id = client_request_id).
 *
 * Read-only. Gated by PRACTICE_ASYNC_GENERATE to mirror the enqueue endpoint.
 */
function isAsyncGenerateEnabled(): boolean {
	const raw = process.env.PRACTICE_ASYNC_GENERATE?.trim().toLowerCase();
	if (process.env.NODE_ENV !== "production") return true;
	return raw === "true";
}

/** Highest completed checklist bucket index for this generation (0 if none yet). */
async function computeDoneThrough(admin: ServiceRoleClient, studentId: string, key: string): Promise<number> {
	const { data: run, error: runErr } = await admin
		.from("practice_generation_runs")
		.select("id")
		.eq("correlation_id", key)
		.eq("student_id", studentId)
		.maybeSingle<{ id: string }>();
	if (runErr || !run?.id) return 0;

	const { data: steps, error: stepsErr } = await admin
		.from("practice_generation_steps")
		.select("step_key")
		.eq("run_id", run.id)
		.eq("status", "ok");
	if (stepsErr || !steps) return 0;

	let doneThrough = 0;
	for (const s of steps as { step_key: string }[]) {
		const bucket = bucketForStepKey(s.step_key);
		if (!bucket) continue;
		doneThrough = Math.max(doneThrough, BUCKET_INDEX[bucket]);
	}
	return doneThrough;
}

export async function GET(request: Request) {
	if (!isAsyncGenerateEnabled()) {
		return Response.json({ status: "not_found" }, { status: 404 });
	}

	const key = new URL(request.url).searchParams.get("key")?.trim() ?? "";
	if (!UUID_RE.test(key)) {
		return Response.json({ status: "error", message: "Invalid key." }, { status: 400 });
	}

	const auth = await getApiRequestUser(request);
	if (!auth) {
		return Response.json({ status: "error", message: "Unauthorized." }, { status: 401 });
	}
	const studentId = auth.user.id;
	const admin = createServiceRoleClient();

	// Done: the test for this key exists.
	const { data: test, error: testErr } = await admin
		.from("tests")
		.select("id")
		.eq("student_id", studentId)
		.eq("client_request_id", key)
		.maybeSingle<{ id: string }>();
	if (testErr) {
		logSupabaseError("studentGenerateStatus.tests", testErr, { studentId });
		return Response.json({ status: "error", message: "Could not read status." }, { status: 500 });
	}
	if (test?.id) {
		return Response.json({ status: "done", testId: test.id, doneThrough: BUCKET_TOTAL, total: BUCKET_TOTAL });
	}

	// Otherwise inspect the job for this key.
	const { data: job, error: jobErr } = await admin
		.from("practice_jobs")
		.select("status, error")
		.eq("student_id", studentId)
		.eq("job_type", "student_generate_test")
		.eq("payload->>client_request_id", key)
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle<{ status: string; error: string | null }>();
	if (jobErr) {
		logSupabaseError("studentGenerateStatus.jobs", jobErr, { studentId });
		return Response.json({ status: "error", message: "Could not read status." }, { status: 500 });
	}

	if (!job) {
		// Enqueued moments ago (or unknown key) — treat as pending; the client keeps polling.
		return Response.json({ status: "pending", doneThrough: 0, total: BUCKET_TOTAL });
	}
	if (job.status === "dead") {
		return Response.json({ status: "failed", message: job.error ?? "Generation failed. Please try again." });
	}
	if (job.status === "done") {
		// Job finished but no test row for this key — shouldn't happen; surface as failure.
		return Response.json({ status: "failed", message: "Generation finished without a test. Please try again." });
	}

	const doneThrough = await computeDoneThrough(admin, studentId, key);
	return Response.json({
		status: job.status === "running" ? "running" : "pending",
		doneThrough,
		total: BUCKET_TOTAL,
	});
}
