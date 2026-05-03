import "server-only";

import { and, desc, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

import { db } from "@/db";
import { aiPrompts } from "@/db/schema/ai-prompts";

type AiPromptRow = InferSelectModel<typeof aiPrompts>;

const mem = new Map<string, { exp: number; row: AiPromptRow | null }>();
const DEFAULT_TTL_MS = 30_000;

/**
 * Returns the active versioned prompt for a feature, or null to use file defaults.
 * Short in-process TTL so prompt activation propagates without polling other instances
 * (cross-instance: up to {@link DEFAULT_TTL_MS} before each instance sees the new row).
 */
export async function getActiveAiPrompt(
	feature: string,
	ttlMs: number = DEFAULT_TTL_MS,
): Promise<AiPromptRow | null> {
	const now = Date.now();
	const hit = mem.get(feature);
	if (hit && hit.exp > now) {
		return hit.row;
	}
	const rows = await db
		.select()
		.from(aiPrompts)
		.where(and(eq(aiPrompts.feature, feature), eq(aiPrompts.isActive, true)))
		.orderBy(desc(aiPrompts.version))
		.limit(1);
	const row = rows[0] ?? null;
	mem.set(feature, { exp: now + ttlMs, row });
	return row;
}

/** Clears in-process cache for one feature (same server instance). */
export function invalidateAiPromptMemoryCache(feature: string): void {
	mem.delete(feature);
}
