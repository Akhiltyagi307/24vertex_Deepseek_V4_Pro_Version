import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { db } from "@/db";
import { subscriptions } from "@/db/schema/billing";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

/**
 * Clears local `cancel_at_period_end` only when there is no Razorpay subscription id
 * (offline / comp rows). Linked subscriptions must be resumed in Razorpay first.
 */
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
				cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
				razorpaySubscriptionId: subscriptions.razorpaySubscriptionId,
			})
			.from(subscriptions)
			.where(eq(subscriptions.id, uuid.data))
			.limit(1);

		const sub = rows[0];
		if (!sub) {
			return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
		}
		if (sub.razorpaySubscriptionId) {
			return NextResponse.json(
				{
					error:
						"This subscription is linked to Razorpay. Resume or undo cancellation in the Razorpay dashboard, then refresh.",
				},
				{ status: 400, headers: adminHeaders() },
			);
		}
		if (!sub.cancelAtPeriodEnd) {
			return NextResponse.json({ ok: true, noop: true }, { headers: adminHeaders() });
		}

		const now = new Date();
		await db
			.update(subscriptions)
			.set({ cancelAtPeriodEnd: false, updatedAt: now })
			.where(eq(subscriptions.id, uuid.data));

		await writeAdminAction({
			action: "subscription_clear_cancel_at_period_end",
			targetType: "subscription",
			targetId: uuid.data,
			payload: {},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
