import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { operatorJobs } from "@/db/schema/operator-jobs";

export type OperatorJobStatus = "queued" | "active" | "completed" | "failed" | "delayed";

export async function insertOperatorJobQueued(input: {
	id: string;
	queue: string;
	name: string;
	payload: Record<string, unknown>;
	triggeredBy?: string;
}): Promise<void> {
	const now = new Date();
	await db.insert(operatorJobs).values({
		id: input.id,
		queue: input.queue,
		name: input.name,
		payload: input.payload,
		status: "queued",
		progress: 0,
		attempts: 0,
		maxAttempts: 3,
		createdAt: now,
		triggeredBy: input.triggeredBy ?? "admin",
	});
}

export async function markOperatorJobActive(id: string): Promise<void> {
	const now = new Date();
	await db
		.update(operatorJobs)
		.set({ status: "active", startedAt: now })
		.where(eq(operatorJobs.id, id));
}

export async function updateOperatorJobProgress(id: string, progressPct0to100: number): Promise<void> {
	await db.update(operatorJobs).set({ progress: Math.round(progressPct0to100) }).where(eq(operatorJobs.id, id));
}

export async function completeOperatorJob(id: string, result?: Record<string, unknown>): Promise<void> {
	const now = new Date();
	await db
		.update(operatorJobs)
		.set({
			status: "completed",
			progress: 100,
			finishedAt: now,
			result: result ?? null,
			error: null,
		})
		.where(eq(operatorJobs.id, id));
}

export async function failOperatorJob(id: string, message: string): Promise<void> {
	const now = new Date();
	await db
		.update(operatorJobs)
		.set({
			status: "failed",
			finishedAt: now,
			error: message,
		})
		.where(eq(operatorJobs.id, id));
}

/** Re-queue a failed job for the Postgres-backed operator worker. */
export async function resetOperatorJobForRetry(id: string): Promise<void> {
	await db
		.update(operatorJobs)
		.set({
			status: "queued",
			error: null,
			result: null,
			startedAt: null,
			finishedAt: null,
			progress: 0,
		})
		.where(and(eq(operatorJobs.id, id), eq(operatorJobs.status, "failed")));
}
