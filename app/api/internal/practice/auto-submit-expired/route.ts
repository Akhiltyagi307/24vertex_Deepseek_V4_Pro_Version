import { recordPracticeEvent } from "@/lib/practice/analytics";
import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Finds `in_progress` tests whose server-stamped `started_at + time_limit`
 * has passed (plus 10s grace) and flips them to `grading`, then enqueues a
 * grade job. This covers the case where the student closed the tab without
 * submitting.
 */
async function runAutoSubmitExpired(): Promise<Response> {
	const admin = createServiceRoleClient();

	// Pull candidates. Limit to 100 per invocation to keep the worker cheap.
	const { data: expired, error } = await admin
		.from("tests")
		.select("id, student_id, subject_id, started_at, time_limit_seconds, duration_seconds")
		.eq("status", "in_progress")
		.not("started_at", "is", null)
		.limit(100);
	if (error) {
		logSupabaseError("runAutoSubmitExpired.tests.select", error);
		return Response.json({ success: false, ok: false, message: "Could not load tests." }, { status: 500 });
	}

	const now = Date.now();
	const toExpire = (expired ?? []).filter((t) => {
		const started = t.started_at ? Date.parse(t.started_at as string) : 0;
		const limit = typeof t.time_limit_seconds === "number" ? t.time_limit_seconds : 3600;
		return started > 0 && started + (limit + 10) * 1000 <= now;
	});

	let flipped = 0;
	for (const t of toExpire) {
		const elapsed = Math.max(
			0,
			Math.floor((now - Date.parse(t.started_at as string)) / 1000),
		);

		// Atomic flip: only if the row is still in_progress.
		const { data: updated, error: upErr } = await admin
			.from("tests")
			.update({
				status: "grading",
				auto_submitted: true,
				test_date: new Date().toISOString(),
				duration_seconds: Math.min(elapsed, (t.time_limit_seconds as number | null) ?? elapsed),
				updated_at: new Date().toISOString(),
			})
			.eq("id", t.id as string)
			.eq("status", "in_progress")
			.select("id")
			.maybeSingle();

		if (upErr || !updated) continue;
		flipped++;

		// Enqueue grade job via the RPC so policy + types stay consistent.
		const { error: enqueueError } = await admin.rpc("practice_enqueue_job", {
			p_job_type: "grade",
			p_test_id: t.id as string,
			p_payload: { auto_submitted: true },
			p_run_after: new Date().toISOString(),
		});
		if (enqueueError) {
			logSupabaseError("runAutoSubmitExpired.practice_enqueue_job", enqueueError, {
				testId: t.id as string,
			});
			const { error: restoreError } = await admin
				.from("tests")
				.update({
					status: "in_progress",
					auto_submitted: false,
					duration_seconds: t.duration_seconds ?? null,
					updated_at: new Date().toISOString(),
				})
				.eq("id", t.id as string)
				.eq("status", "grading");
			if (restoreError) {
				logSupabaseError("runAutoSubmitExpired.tests.restore", restoreError, {
					testId: t.id as string,
				});
			}
			continue;
		}
		void recordPracticeEvent(
			admin,
			"practice_auto_submitted",
			{ test_id: t.id as string, elapsed_seconds: elapsed },
			{ studentId: t.student_id as string },
		);
	}

	return Response.json({
		ok: true,
		considered: (expired ?? []).length,
		flipped,
	});
}

export async function POST(request: Request) {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;
	return runAutoSubmitExpired();
}

export async function GET(request: Request) {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;
	return runAutoSubmitExpired();
}
