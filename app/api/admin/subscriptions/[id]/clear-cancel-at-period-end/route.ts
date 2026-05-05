import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { subscriptions } from "@/db/schema/billing";

export const runtime = "nodejs";

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
		if (!uuid.success) return adminErrorResponse("Invalid subscription id");

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
		if (!sub) return adminErrorResponse("Not found", { status: 404 });
		if (sub.razorpaySubscriptionId) {
			return adminErrorResponse(
				"This subscription is linked to Razorpay. Resume or undo cancellation in the Razorpay dashboard, then refresh.",
			);
		}
		if (!sub.cancelAtPeriodEnd) return adminAckResponse({ noop: true });

		const now = new Date();
		await db
			.update(subscriptions)
			.set({ cancelAtPeriodEnd: false, updatedAt: now })
			.where(eq(subscriptions.id, uuid.data));

		await writeAdminAction({
			action: ADMIN_ACTIONS.SUBSCRIPTION_CLEAR_CANCEL_AT_PERIOD_END,
			targetType: "subscription",
			targetId: uuid.data,
			payload: {},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
