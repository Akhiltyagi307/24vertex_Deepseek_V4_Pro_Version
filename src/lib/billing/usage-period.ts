import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { subscriptions, usagePeriods } from "@/db/schema/billing";
import { logServerError } from "@/lib/server/log-supabase-error";

/** How many recent periods to consider when picking the "current" one. */
const USAGE_PERIOD_LOOKBACK = 48;

export type CurrentUsagePeriod = {
	id: string;
	subscriptionId: string;
	periodStart: Date;
	periodEnd: Date;
	testsUsed: number;
	testsQuota: number;
	tokensUsed: number;
	tokensQuota: number;
};

/**
 * Single source of truth for "what is the current usage period for this
 * profile?" — used by the threshold notifier and by the entitlements
 * test/token consume paths.
 *
 * Rules (matches the prior `entitlements.ts` semantics, which is the stricter
 * of the two existing implementations):
 *
 * - Considers up to {@link USAGE_PERIOD_LOOKBACK} most-recent periods (latest
 *   `period_end` first) for this profile's subscription.
 * - Prefers a strictly-active period (`period_start <= now < period_end`).
 * - Falls back to the most recently ended period only if none is currently
 *   active. This keeps threshold dedup keyed against a real period id even
 *   right after rollover and before the new period row is created.
 *
 * Returns `null` when the profile has no subscription or no usage rows.
 */
export async function findCurrentUsagePeriod(profileId: string): Promise<CurrentUsagePeriod | null> {
	try {
		const now = new Date();
		const rows = await db
			.select({
				id: usagePeriods.id,
				subscriptionId: usagePeriods.subscriptionId,
				periodStart: usagePeriods.periodStart,
				periodEnd: usagePeriods.periodEnd,
				testsUsed: usagePeriods.testsUsed,
				testsQuota: usagePeriods.testsQuota,
				tokensUsed: usagePeriods.tokensUsed,
				tokensQuota: usagePeriods.tokensQuota,
			})
			.from(usagePeriods)
			.innerJoin(subscriptions, eq(subscriptions.id, usagePeriods.subscriptionId))
			.where(eq(subscriptions.profileId, profileId))
			.orderBy(desc(usagePeriods.periodEnd))
			.limit(USAGE_PERIOD_LOOKBACK);

		if (rows.length === 0) return null;

		const active = rows.find((r) => r.periodStart.getTime() <= now.getTime() && r.periodEnd.getTime() > now.getTime());
		const chosen = active ?? rows[0];
		return {
			id: chosen.id,
			subscriptionId: chosen.subscriptionId,
			periodStart: chosen.periodStart,
			periodEnd: chosen.periodEnd,
			testsUsed: Number(chosen.testsUsed ?? 0),
			testsQuota: Number(chosen.testsQuota ?? 0),
			tokensUsed: Number(chosen.tokensUsed ?? 0),
			tokensQuota: Number(chosen.tokensQuota ?? 0),
		};
	} catch (err) {
		logServerError("billing.usage_period.find_current", err, { profileId });
		return null;
	}
}

/** Convenience for callers that only need the period id (e.g. threshold dedup). */
export async function findCurrentUsagePeriodId(profileId: string): Promise<string | null> {
	const period = await findCurrentUsagePeriod(profileId);
	return period?.id ?? null;
}

/** Re-export for callers that still want to limit themselves to "anything started by now". */
export const USAGE_PERIOD_LOOKBACK_LIMIT = USAGE_PERIOD_LOOKBACK;
