import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import {
	canFlipSubscriptionStatusOffline,
	isSubscriptionStatus,
} from "@/lib/billing/subscription-admin-transitions";
import { db } from "@/db";
import { subscriptions } from "@/db/schema/billing";

export const runtime = "nodejs";

const bodySchema = z.object({
	target_status: z.string().trim().min(1).max(20),
	reason: z.string().max(2000).optional(),
}).strict();

/**
 * Offline-only status correction when there is no Razorpay subscription id.
 * Linked subscriptions must follow Razorpay + webhooks.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid subscription id");

		let raw: unknown;
		try {
			raw = await request.json();
		} catch {
			return adminErrorResponse("Invalid JSON");
		}
		const parsed = bodySchema.safeParse(raw);
		if (!parsed.success) {
			return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
		}
		if (!isSubscriptionStatus(parsed.data.target_status)) {
			return adminErrorResponse("Invalid target_status");
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
		if (!sub) return adminErrorResponse("Not found", { status: 404 });
		if (sub.razorpaySubscriptionId) {
			return adminErrorResponse(
				"This subscription is linked to Razorpay. Do not flip status in DB; use Razorpay, webhooks, or cancel-now.",
			);
		}

		if (!canFlipSubscriptionStatusOffline(sub.status, parsed.data.target_status)) {
			return adminErrorResponse(`Transition not allowed: ${sub.status} → ${parsed.data.target_status}`);
		}

		const now = new Date();
		await db
			.update(subscriptions)
			.set({ status: parsed.data.target_status, updatedAt: now })
			.where(eq(subscriptions.id, uuid.data));

		await writeAdminAction({
			action: ADMIN_ACTIONS.SUBSCRIPTION_FLIP_STATUS,
			targetType: "subscription",
			targetId: uuid.data,
			payload: {
				from: sub.status,
				to: parsed.data.target_status,
				reason: parsed.data.reason ?? null,
				offline_only: true,
			},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse({ status: parsed.data.target_status });
	});
}
