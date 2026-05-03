import "server-only";

import { and, asc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { quotaGrants } from "@/db/schema/billing";

/**
 * Consumes one test from the oldest eligible manual grant (FIFO by expires_at).
 * Returns true when a row was incremented.
 */
export async function consumeNextQuotaTestGrant(profileId: string): Promise<boolean> {
	const grant = await db
		.select({ id: quotaGrants.id })
		.from(quotaGrants)
		.where(
			and(
				eq(quotaGrants.studentId, profileId),
				eq(quotaGrants.grantType, "tests"),
				lt(quotaGrants.consumed, quotaGrants.quantity),
				or(isNull(quotaGrants.expiresAt), gt(quotaGrants.expiresAt, sql`now()`)),
			),
		)
		.orderBy(asc(quotaGrants.expiresAt))
		.limit(1);
	const gid = grant[0]?.id;
	if (!gid) return false;
	const updated = await db
		.update(quotaGrants)
		.set({ consumed: sql`${quotaGrants.consumed} + 1` })
		.where(and(eq(quotaGrants.id, gid), lt(quotaGrants.consumed, quotaGrants.quantity)))
		.returning({ id: quotaGrants.id });
	return updated.length > 0;
}
