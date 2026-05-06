import { and, eq, lt } from "drizzle-orm";

import { db } from "@/db";
import { subscriptions } from "@/db/schema/billing";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * W3.1 — hourly expiry of `coupon`-status subscriptions whose period ended.
 *
 * Entitlement coupons grant access for `duration_days`. Without this cron,
 * a 30-day grant would keep status='coupon' indefinitely past
 * current_period_end, leaving the student with Pro entitlements forever.
 *
 * Runs hourly on :15 so the worst-case extra access is ~1h past expiry —
 * acceptable margin without thrashing the cron infra.
 */
async function handle(request: Request): Promise<Response> {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;

	const now = new Date();
	const expired = await db
		.update(subscriptions)
		.set({ status: "expired", updatedAt: now })
		.where(and(eq(subscriptions.status, "coupon"), lt(subscriptions.currentPeriodEnd, now)))
		.returning({ id: subscriptions.id, profileId: subscriptions.profileId });

	if (expired.length > 0) {
		// Per-profile analytics emitted via service-role client so they show up
		// in the practice-events stream alongside the user's other lifecycle.
		const admin = createServiceRoleClient();
		await admin.from("practice_analytics_events").insert(
			expired.map((row) => ({
				student_id: row.profileId,
				event_name: "subscription_coupon_expired",
				props: { subscription_id: row.id },
			})),
		);

		await writeAdminAction({
			action: ADMIN_ACTIONS.SUBSCRIPTION_COUPON_AUTO_EXPIRED,
			targetType: "subscription",
			payload: { count: expired.length, ids: expired.map((d) => d.id) },
		});
	}

	return Response.json({ ok: true, expired: expired.length });
}

export async function POST(request: Request): Promise<Response> {
	return handle(request);
}

export async function GET(request: Request): Promise<Response> {
	return handle(request);
}
