import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { operatorJobs } from "@/db/schema/operator-jobs";
import { runBulkReinitTrackersByGrade } from "@/lib/admin/bulk-reinit-job";
import { BULK_TRACKER_QUEUE } from "@/lib/jobs/queue-names";
import { failOperatorJob } from "@/lib/jobs/operator-job-mirror";
import { isOperatorQueuePaused } from "@/lib/jobs/operator-queue-pause";
import { logServerError } from "@/lib/server/log-supabase-error";

export type ClaimedOperatorJob = {
	id: string;
	queue: string;
	name: string;
	payload: Record<string, unknown> | null;
};

export async function claimNextQueuedOperatorJob(): Promise<ClaimedOperatorJob | null> {
	const rows = await db.execute(sql`
		WITH picked AS (
			SELECT id FROM jobs
			WHERE status = 'queued'
			ORDER BY created_at ASC
			FOR UPDATE SKIP LOCKED
			LIMIT 1
		)
		UPDATE jobs j
		SET status = 'active', started_at = now()
		FROM picked
		WHERE j.id = picked.id
		RETURNING j.id, j.queue, j.name, j.payload
	`);
	const list = rows as unknown as Record<string, unknown>[];
	const r = list[0];
	if (!r) return null;
	return {
		id: String(r.id),
		queue: String(r.queue),
		name: String(r.name),
		payload: (r.payload as Record<string, unknown> | null) ?? null,
	};
}

/** Lease window after which an `active` operator job is presumed dead and reclaimed. */
const OPERATOR_JOB_LEASE_MINUTES = 15;

/**
 * Requeue operator jobs stuck in `active` after a worker crash/timeout (review
 * finding M2). The operator queue had no lease at all — unlike practice_jobs, a
 * job flipped to `active` by a worker that then died sat `active` forever
 * (resetOperatorJobForRetry only recovers `failed`, and never from `active`).
 * This resets `active` rows past the lease back to `queued` so the drain retries
 * them, incrementing attempts; a row that has already exhausted max_attempts is
 * sent to `failed` (with a reason) instead of looping forever. SKIP LOCKED so it
 * never contends with an actively-running claim. Returns the number reclaimed.
 */
export async function reclaimStaleActiveOperatorJobs(): Promise<number> {
	const rows = await db.execute(sql`
		WITH stale AS (
			SELECT id FROM jobs
			WHERE status = 'active'
			  AND started_at IS NOT NULL
			  AND started_at < now() - make_interval(mins => ${OPERATOR_JOB_LEASE_MINUTES})
			FOR UPDATE SKIP LOCKED
		)
		UPDATE jobs j
		SET status = CASE WHEN j.attempts >= j.max_attempts THEN 'failed' ELSE 'queued' END,
			attempts = j.attempts + 1,
			started_at = NULL,
			finished_at = CASE WHEN j.attempts >= j.max_attempts THEN now() ELSE j.finished_at END,
			error = CASE WHEN j.attempts >= j.max_attempts
				THEN 'reclaimed: exceeded max attempts after stalling in active'
				ELSE j.error END
		FROM stale
		WHERE j.id = stale.id
		RETURNING j.id
	`);
	const list = rows as unknown as Record<string, unknown>[];
	return list.length;
}

export async function releaseOperatorJobToQueued(id: string): Promise<void> {
	await db
		.update(operatorJobs)
		.set({ status: "queued", startedAt: null })
		.where(eq(operatorJobs.id, id));
}

export async function executeClaimedOperatorJob(row: ClaimedOperatorJob): Promise<void> {
	if (row.queue === BULK_TRACKER_QUEUE && row.name === "reinit-by-grade") {
		const grade = Number(row.payload?.grade);
		if (!Number.isFinite(grade) || grade < 1 || grade > 12) {
			await failOperatorJob(row.id, "invalid_grade");
			return;
		}
		await runBulkReinitTrackersByGrade(row.id, grade, { operatorJobId: row.id });
		return;
	}
	await failOperatorJob(row.id, `unsupported_job:${row.queue}:${row.name}`);
}

const DEFAULT_MAX_PER_INVOCATION = 5;

export async function runOperatorJobDrain(opts?: { maxJobs?: number }): Promise<{
	processed: number;
	stoppedForPause: boolean;
	reclaimed: number;
}> {
	const maxJobs = opts?.maxJobs ?? DEFAULT_MAX_PER_INVOCATION;
	let processed = 0;
	let stoppedForPause = false;
	// Reclaim jobs stuck `active` from a previously-crashed worker before draining.
	let reclaimed = 0;
	try {
		reclaimed = await reclaimStaleActiveOperatorJobs();
	} catch (e) {
		logServerError("runOperatorJobDrain.reclaim", e);
	}
	for (let i = 0; i < maxJobs; i++) {
		const row = await claimNextQueuedOperatorJob();
		if (!row) break;
		if (await isOperatorQueuePaused(row.queue)) {
			await releaseOperatorJobToQueued(row.id);
			stoppedForPause = true;
			break;
		}
		try {
			await executeClaimedOperatorJob(row);
			processed += 1;
		} catch (e) {
			logServerError("runOperatorJobDrain.job", e, { jobId: row.id });
			await failOperatorJob(row.id, e instanceof Error ? e.message : String(e));
			processed += 1;
		}
	}
	return { processed, stoppedForPause, reclaimed };
}
