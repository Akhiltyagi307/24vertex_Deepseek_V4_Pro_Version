import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Phase 6: emits daily rollups as analytics events so Metabase / ad-hoc SQL
 * can plot funnels and success rates without re-running heavy queries.
 *
 * Kept intentionally lightweight: a handful of aggregates over the previous
 * 24 hours written as a single `practice_metrics_daily` event per run.
 */
async function runMetricsRollup(): Promise<Response> {
	const admin = createServiceRoleClient();
	const since = new Date(Date.now() - 24 * 3600_000).toISOString();

	const [tests, reports, jobs, flags] = await Promise.all([
		admin
			.from("tests")
			.select("id, status, auto_submitted, duration_seconds, time_limit_seconds, created_at")
			.gte("created_at", since),
		admin
			.from("test_reports")
			.select("test_id, grading_failed_at, created_at")
			.gte("created_at", since),
		admin
			.from("practice_jobs")
			.select("job_type, status, attempts, created_at, claimed_at, updated_at")
			.gte("created_at", since),
		admin.from("question_flags").select("id, created_at").gte("created_at", since),
	]);

	const sourceError =
		tests.error ?? reports.error ?? jobs.error ?? flags.error;
	if (sourceError) {
		logSupabaseError("runMetricsRollup.sourceQuery", sourceError, { since });
		return Response.json({ success: false, ok: false, message: "Could not load practice metrics." }, { status: 500 });
	}

	const testsRows = tests.data ?? [];
	const reportsRows = reports.data ?? [];
	const jobsRows = jobs.data ?? [];

	const byStatus: Record<string, number> = {};
	let autoSubmitted = 0;
	let totalElapsed = 0;
	let elapsedCount = 0;
	for (const t of testsRows) {
		const s = String(t.status ?? "unknown");
		byStatus[s] = (byStatus[s] ?? 0) + 1;
		if (t.auto_submitted) autoSubmitted++;
		const dur = typeof t.duration_seconds === "number" ? t.duration_seconds : null;
		if (dur != null && dur > 0) {
			totalElapsed += dur;
			elapsedCount++;
		}
	}

	const gradingFailures = reportsRows.filter((r) => r.grading_failed_at).length;

	const jobByType: Record<string, { total: number; done: number; failed: number; dead: number }> = {};
	for (const j of jobsRows) {
		const k = String(j.job_type);
		if (!jobByType[k]) jobByType[k] = { total: 0, done: 0, failed: 0, dead: 0 };
		jobByType[k].total++;
		if (j.status === "done") jobByType[k].done++;
		if (j.status === "failed") jobByType[k].failed++;
		if (j.status === "dead") jobByType[k].dead++;
	}

	const payload = {
		window_seconds: 86400,
		tests: {
			total: testsRows.length,
			by_status: byStatus,
			auto_submitted: autoSubmitted,
			avg_duration_seconds:
				elapsedCount > 0 ? Math.round(totalElapsed / elapsedCount) : null,
		},
		grading: {
			reports: reportsRows.length,
			failures: gradingFailures,
		},
		jobs: jobByType,
		question_flags: (flags.data ?? []).length,
	};

	const { error: insertError } = await admin.from("practice_analytics_events").insert({
		event_name: "practice_metrics_daily",
		props: payload,
	});
	if (insertError) {
		logSupabaseError("runMetricsRollup.practice_analytics_events.insert", insertError, { since });
		return Response.json({ success: false, ok: false, message: "Could not store practice metrics." }, { status: 500 });
	}

	return Response.json({ ok: true, payload });
}

export async function POST(request: Request) {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;
	return runMetricsRollup();
}

export async function GET(request: Request) {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;
	return runMetricsRollup();
}
