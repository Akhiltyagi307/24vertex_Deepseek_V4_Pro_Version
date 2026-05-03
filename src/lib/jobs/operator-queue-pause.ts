import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { adminRuntimeKv } from "@/db/schema/admin-runtime-kv";

export function operatorQueuePauseKey(queueName: string): string {
	return `operator_queue_paused:${queueName}`;
}

export async function isOperatorQueuePaused(queueName: string): Promise<boolean> {
	const key = operatorQueuePauseKey(queueName);
	const rows = await db.select().from(adminRuntimeKv).where(eq(adminRuntimeKv.key, key)).limit(1);
	const v = rows[0]?.valueJson as { paused?: boolean } | null | undefined;
	return Boolean(v?.paused);
}

export async function setOperatorQueuePaused(queueName: string, paused: boolean): Promise<void> {
	const key = operatorQueuePauseKey(queueName);
	const now = new Date();
	if (!paused) {
		await db.delete(adminRuntimeKv).where(eq(adminRuntimeKv.key, key));
		return;
	}
	await db
		.insert(adminRuntimeKv)
		.values({ key, valueInt: 0, valueJson: { paused: true }, updatedAt: now })
		.onConflictDoUpdate({
			target: adminRuntimeKv.key,
			set: { valueJson: { paused: true }, updatedAt: now },
		});
}
