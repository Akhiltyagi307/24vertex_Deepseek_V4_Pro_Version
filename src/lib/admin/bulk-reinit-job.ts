import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { adminRuntimeKv } from "@/db/schema/admin-runtime-kv";
import { profiles } from "@/db/schema/profiles";
import {
	completeOperatorJob,
	failOperatorJob,
	markOperatorJobActive,
	updateOperatorJobProgress,
} from "@/lib/jobs/operator-job-mirror";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type BulkReinitJobStatus = "queued" | "running" | "done" | "failed";

export type BulkReinitJobState = {
	status: BulkReinitJobStatus;
	processed: number;
	total: number;
	error?: string;
	grade: number;
};

const KEY_PREFIX = "bulk_reinit:";

export function bulkReinitKvKey(jobId: string): string {
	return `${KEY_PREFIX}${jobId}`;
}

export async function readBulkReinitJob(jobId: string): Promise<BulkReinitJobState | null> {
	const key = bulkReinitKvKey(jobId);
	const rows = await db.select().from(adminRuntimeKv).where(eq(adminRuntimeKv.key, key)).limit(1);
	const row = rows[0];
	if (!row?.valueJson) return null;
	return row.valueJson as BulkReinitJobState;
}

export async function writeBulkReinitJob(jobId: string, state: BulkReinitJobState): Promise<void> {
	const key = bulkReinitKvKey(jobId);
	const now = new Date();
	await db
		.insert(adminRuntimeKv)
		.values({
			key,
			valueInt: 0,
			valueJson: state,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: adminRuntimeKv.key,
			set: { valueJson: state, updatedAt: now },
		});
}

export type RunBulkReinitOptions = {
	/** Sync `public.jobs` (operator mirror) when set. */
	operatorJobId?: string | null;
};

async function syncOperatorMirror(operatorJobId: string | null | undefined, state: BulkReinitJobState): Promise<void> {
	if (!operatorJobId) return;
	try {
		if (state.status === "running") {
			if (state.processed === 0) {
				await markOperatorJobActive(operatorJobId);
			}
			const pct = state.total > 0 ? (state.processed / state.total) * 100 : 0;
			await updateOperatorJobProgress(operatorJobId, pct);
		} else if (state.status === "done") {
			await completeOperatorJob(operatorJobId, {
				grade: state.grade,
				processed: state.processed,
				total: state.total,
			});
		} else if (state.status === "failed") {
			await failOperatorJob(operatorJobId, state.error ?? "unknown error");
		}
	} catch (e) {
		console.error("syncOperatorMirror", { operatorJobId, e });
	}
}

/**
 * Runs bulk tracker re-init for all students in `grade`. Updates KV progress for polling UI.
 */
export async function runBulkReinitTrackersByGrade(
	jobId: string,
	grade: number,
	opts?: RunBulkReinitOptions,
): Promise<void> {
	const operatorJobId = opts?.operatorJobId ?? null;
	const admin = createServiceRoleClient();
	const studentRows = await db
		.select({ id: profiles.id })
		.from(profiles)
		.where(and(eq(profiles.role, "student"), eq(profiles.grade, grade), isNull(profiles.deletedAt)));

	const total = studentRows.length;
	const running: BulkReinitJobState = { status: "running", processed: 0, total, grade };
	await writeBulkReinitJob(jobId, running);
	await syncOperatorMirror(operatorJobId, running);

	let processed = 0;
	for (const { id } of studentRows) {
		const { error } = await admin.rpc("sync_student_performance_tracker_for_student", {
			p_student_id: id,
			p_reset_curriculum: true,
		});
		if (error) {
			logSupabaseError("runBulkReinitTrackersByGrade.rpc", error, { studentId: id, jobId });
			const failed: BulkReinitJobState = {
				status: "failed",
				processed,
				total,
				grade,
				error: error.message,
			};
			await writeBulkReinitJob(jobId, failed);
			await syncOperatorMirror(operatorJobId, failed);
			return;
		}
		const { error: e2 } = await admin.rpc("sync_student_performance_tracker_for_student", {
			p_student_id: id,
			p_reset_curriculum: false,
		});
		if (e2) {
			logSupabaseError("runBulkReinitTrackersByGrade.rpc2", e2, { studentId: id, jobId });
			const failed: BulkReinitJobState = {
				status: "failed",
				processed,
				total,
				grade,
				error: e2.message,
			};
			await writeBulkReinitJob(jobId, failed);
			await syncOperatorMirror(operatorJobId, failed);
			return;
		}
		processed += 1;
		if (processed % 10 === 0 || processed === total) {
			const mid: BulkReinitJobState = { status: "running", processed, total, grade };
			await writeBulkReinitJob(jobId, mid);
			await syncOperatorMirror(operatorJobId, mid);
		}
	}

	const done: BulkReinitJobState = { status: "done", processed: total, total, grade };
	await writeBulkReinitJob(jobId, done);
	await syncOperatorMirror(operatorJobId, done);
}
