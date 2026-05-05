import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { cancelSubscription } from "@/lib/billing/razorpay";
import { db } from "@/db";
import { subscriptions } from "@/db/schema/billing";

export const runtime = "nodejs";

/** Immediate cancel: Razorpay (when linked) then DB `cancelled`. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid subscription id");

		const rows = await db
			.select({
				id: subscriptions.id,
				status: subscriptions.status,
				razorpaySubscriptionId: subscriptions.razorpaySubscriptionId,
			})
			.from(subscriptions)
			.where(eq(subscriptions.id, uuid.data))
			.limit(1);

		const sub = rows[0];
		if (!sub) return adminErrorResponse("Not found", { status: 404 });
		if (sub.status === "cancelled") return adminAckResponse({ noop: true });

		if (sub.razorpaySubscriptionId) {
			try {
				await cancelSubscription(sub.razorpaySubscriptionId, { cancelAtCycleEnd: false });
			} catch (e) {
				Sentry.captureException(e, { tags: { feature: "admin", admin_action: "subscription_cancel_now_rzp" } });
				const msg = e instanceof Error ? e.message : String(e);
				return adminErrorResponse("Razorpay immediate cancel failed; subscription unchanged.", {
					status: 502,
					details: { detail: msg },
				});
			}
		}

		const now = new Date();
		await db
			.update(subscriptions)
			.set({
				status: "cancelled",
				cancelAtPeriodEnd: false,
				updatedAt: now,
			})
			.where(eq(subscriptions.id, uuid.data));

		// Strict audit: cancels the Razorpay subscription (when linked) and
		// flips the DB status. Mutating an external billing system requires a
		// guaranteed audit row.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.SUBSCRIPTION_CANCEL_NOW,
			targetType: "subscription",
			targetId: uuid.data,
			payload: {
				razorpay_subscription_id: sub.razorpaySubscriptionId,
				synced_razorpay: Boolean(sub.razorpaySubscriptionId),
			},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
