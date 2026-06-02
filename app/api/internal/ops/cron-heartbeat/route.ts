import * as Sentry from "@sentry/nextjs";

import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Cron-substrate heartbeat (review finding H1).
 *
 * ALL background + scheduled work on this platform rides one substrate: Supabase
 * pg_cron -> pg_net -> /api/internal/* (grading, billing dunning/expiry, coupon
 * expiry, compliance retention, trial emails, review scheduler). If that
 * substrate stalls — vault `cron_secret` drifts from CRON_SECRET, pg_cron/pg_net
 * is paused, or it was never configured on one of the two projects — every job
 * silently stops and nothing alerts.
 *
 * This endpoint detects the stall WITHOUT depending on the substrate it watches.
 * It reads the practice-jobs queue directly: when draining stops, ready jobs
 * back up. That is both the most reliable signal (run-jobs does not write
 * cron_run_log, so a ledger-freshness check would be unreliable) and the most
 * meaningful (it is exactly the user-facing symptom — tests stop getting
 * graded).
 *
 * Wire an EXTERNAL uptime monitor (independent of Vercel AND Supabase) to GET
 * this with `Authorization: Bearer <CRON_SECRET>` every 1-5 min; a 503 flips it
 * red. A Vercel cron also works (see vercel.json snippet in the PR notes), but
 * an external monitor survives a Vercel-side outage too.
 *
 * Read-only: safe to poll. Returns 200 when healthy, 503 when degraded (so a
 * plain HTTP monitor alerts with no extra config), and captures a Sentry event
 * on degradation.
 */

// A ready-to-run job (run_after already elapsed) that is still pending this long
// means the worker is not draining the queue.
const PENDING_OVERDUE_MINUTES = 10;
// A job claimed this long ago is past the 12-min reclaim window — workers are
// dying mid-job or reclaim itself is not running.
const RUNNING_STUCK_MINUTES = 15;

type HeartbeatReport = {
	ok: boolean;
	checkedAt: string;
	overduePending: number;
	stuckRunning: number;
	oldestPendingMinutes: number | null;
	thresholds: { pendingOverdueMinutes: number; runningStuckMinutes: number };
};

async function runHeartbeat(): Promise<Response> {
	const admin = createServiceRoleClient();
	const now = Date.now();
	const pendingCutoff = new Date(now - PENDING_OVERDUE_MINUTES * 60_000).toISOString();
	const runningCutoff = new Date(now - RUNNING_STUCK_MINUTES * 60_000).toISOString();

	const [overdueRes, stuckRes, oldestRes] = await Promise.all([
		admin
			.from("practice_jobs")
			.select("id", { count: "exact", head: true })
			.eq("status", "pending")
			.lte("run_after", pendingCutoff),
		admin
			.from("practice_jobs")
			.select("id", { count: "exact", head: true })
			.eq("status", "running")
			.lte("claimed_at", runningCutoff),
		admin
			.from("practice_jobs")
			.select("run_after")
			.eq("status", "pending")
			.order("run_after", { ascending: true })
			.limit(1)
			.maybeSingle(),
	]);

	const firstError = overdueRes.error ?? stuckRes.error ?? oldestRes.error;
	if (firstError) {
		logSupabaseError("cronHeartbeat.query", firstError);
		Sentry.captureMessage("cron_heartbeat_query_failed", {
			level: "error",
			extra: { message: firstError.message },
		});
		return Response.json(
			{ ok: false, error: "Heartbeat query failed." },
			{ status: 500 },
		);
	}

	const overduePending = overdueRes.count ?? 0;
	const stuckRunning = stuckRes.count ?? 0;
	const oldestRunAfter = oldestRes.data?.run_after
		? Date.parse(oldestRes.data.run_after as string)
		: null;
	const oldestPendingMinutes =
		oldestRunAfter && oldestRunAfter <= now
			? Math.floor((now - oldestRunAfter) / 60_000)
			: null;

	const degraded = overduePending > 0 || stuckRunning > 0;
	const report: HeartbeatReport = {
		ok: !degraded,
		checkedAt: new Date(now).toISOString(),
		overduePending,
		stuckRunning,
		oldestPendingMinutes,
		thresholds: {
			pendingOverdueMinutes: PENDING_OVERDUE_MINUTES,
			runningStuckMinutes: RUNNING_STUCK_MINUTES,
		},
	};

	if (degraded) {
		Sentry.captureMessage("cron_heartbeat_degraded", {
			level: "error",
			extra: { ...report },
		});
		return Response.json(report, { status: 503 });
	}

	return Response.json(report);
}

async function handle(request: Request): Promise<Response> {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;
	return runHeartbeat();
}

export async function GET(request: Request): Promise<Response> {
	return handle(request);
}

export async function POST(request: Request): Promise<Response> {
	return handle(request);
}
