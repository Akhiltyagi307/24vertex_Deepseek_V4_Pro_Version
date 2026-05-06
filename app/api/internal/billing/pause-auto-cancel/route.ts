import { and, eq, lt } from "drizzle-orm";

import { db } from "@/db";
import { subscriptions } from "@/db/schema/billing";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { cancelSubscription } from "@/lib/billing/razorpay";
import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { logServerError } from "@/lib/server/log-supabase-error";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * W4.2 — auto-cancel any subscription paused longer than 30 days.
 *
 * The grace lets churn-risk users come back; past 30 days, we've effectively
 * lost them and continued billing-state ambiguity costs us reconciliation
 * cycles. The hard-cancel here is the same path admins take from cancel-now,
 * so the user can always re-subscribe through the normal checkout if they
 * change their mind.
 */
const PAUSE_MAX_AGE_MS = 30 * 86_400_000;

async function handle(request: Request): Promise<Response> {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;

	const cutoff = new Date(Date.now() - PAUSE_MAX_AGE_MS);

	const candidates = await db
		.select({
			id: subscriptions.id,
			razorpaySubscriptionId: subscriptions.razorpaySubscriptionId,
			profileId: subscriptions.profileId,
		})
		.from(subscriptions)
		.where(and(eq(subscriptions.status, "paused"), lt(subscriptions.pausedAt, cutoff)))
		.limit(50);

	const cancelled: string[] = [];
	const errors: Array<{ id: string; error: string }> = [];

	for (const sub of candidates) {
		if (sub.razorpaySubscriptionId) {
			try {
				await cancelSubscription(sub.razorpaySubscriptionId, { cancelAtCycleEnd: false });
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				logServerError("billing.pause-auto-cancel.razorpay", e, { subscription_id: sub.id });
				errors.push({ id: sub.id, error: msg });
				continue;
			}
		}
		await db
			.update(subscriptions)
			.set({ status: "cancelled", pausedAt: null, updatedAt: new Date() })
			.where(eq(subscriptions.id, sub.id));
		cancelled.push(sub.id);
	}

	if (cancelled.length > 0 || errors.length > 0) {
		await writeAdminAction({
			action: ADMIN_ACTIONS.SUBSCRIPTION_DUNNING_CANCEL,
			targetType: "subscription",
			payload: { trigger: "pause_30day", cancelled, errors },
		});
	}

	return Response.json({ ok: true, cancelled: cancelled.length, errors: errors.length });
}

export async function POST(request: Request): Promise<Response> {
	return handle(request);
}

export async function GET(request: Request): Promise<Response> {
	return handle(request);
}
