import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import {
	canFlipSubscriptionStatusOffline,
	isSubscriptionStatus,
} from "@/lib/billing/subscription-admin-transitions";
import { db } from "@/db";
import { subscriptions } from "@/db/schema/billing";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

const bodySchema = z.object({
	target_status: z.string().trim().min(1).max(20),
	reason: z.string().max(2000).optional(),
});

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
		if (!uuid.success) {
			return NextResponse.json({ error: "Invalid subscription id" }, { status: 400, headers: adminHeaders() });
		}

		let raw: unknown;
		try {
			raw = await request.json();
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
		}
		const parsed = bodySchema.safeParse(raw);
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
		}
		if (!isSubscriptionStatus(parsed.data.target_status)) {
			return NextResponse.json({ error: "Invalid target_status" }, { status: 400, headers: adminHeaders() });
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
		if (sub.razorpaySubscriptionId) {
			return NextResponse.json(
				{
					error:
						"This subscription is linked to Razorpay. Do not flip status in DB; use Razorpay, webhooks, or cancel-now.",
				},
				{ status: 400, headers: adminHeaders() },
			);
		}

		if (!canFlipSubscriptionStatusOffline(sub.status, parsed.data.target_status)) {
			return NextResponse.json(
				{ error: `Transition not allowed: ${sub.status} → ${parsed.data.target_status}` },
				{ status: 400, headers: adminHeaders() },
			);
		}

		const now = new Date();
		await db
			.update(subscriptions)
			.set({ status: parsed.data.target_status, updatedAt: now })
			.where(eq(subscriptions.id, uuid.data));

		await writeAdminAction({
			action: "subscription_flip_status",
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

		return NextResponse.json({ ok: true, status: parsed.data.target_status }, { headers: adminHeaders() });
	});
}
