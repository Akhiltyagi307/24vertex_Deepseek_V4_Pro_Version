import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { cancelSubscription } from "@/lib/billing/razorpay";
import { db } from "@/db";
import { subscriptions } from "@/db/schema/billing";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

/** Immediate cancel: Razorpay (when linked) then DB `cancelled`. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) {
			return NextResponse.json({ error: "Invalid subscription id" }, { status: 400, headers: adminHeaders() });
		}

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
		if (!sub) {
			return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
		}
		if (sub.status === "cancelled") {
			return NextResponse.json({ ok: true, noop: true }, { headers: adminHeaders() });
		}

		if (sub.razorpaySubscriptionId) {
			try {
				await cancelSubscription(sub.razorpaySubscriptionId, { cancelAtCycleEnd: false });
			} catch (e) {
				Sentry.captureException(e, { tags: { feature: "admin", admin_action: "subscription_cancel_now_rzp" } });
				const msg = e instanceof Error ? e.message : String(e);
				return NextResponse.json(
					{ error: "Razorpay immediate cancel failed; subscription unchanged.", detail: msg },
					{ status: 502, headers: adminHeaders() },
				);
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

		await writeAdminAction({
			action: "subscription_cancel_now",
			targetType: "subscription",
			targetId: uuid.data,
			payload: {
				razorpay_subscription_id: sub.razorpaySubscriptionId,
				synced_razorpay: Boolean(sub.razorpaySubscriptionId),
			},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
