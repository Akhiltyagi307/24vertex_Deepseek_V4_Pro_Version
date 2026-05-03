import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { addPlanBillingInterval } from "@/lib/billing/add-plan-billing-interval";
import { db } from "@/db";
import { plans, subscriptions, usagePeriods } from "@/db/schema/billing";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

const bodySchema = z.object({
	/** When set, extends `current_period_end` by this many whole days instead of plan interval. */
	extend_days: z.number().int().min(1).max(730).optional(),
});

/**
 * Pushes `current_period_end` forward (offline / comp). Razorpay-linked rows are
 * rejected unless `ADMIN_BILLING_FORCE_RENEW_RZP=1` (dangerous; prefer real charges).
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const subId = z.string().uuid().safeParse(id);
		if (!subId.success) {
			return NextResponse.json({ error: "Invalid subscription id" }, { status: 400, headers: adminHeaders() });
		}

		let raw: unknown = {};
		try {
			raw = await request.json();
		} catch {
			raw = {};
		}
		const parsed = bodySchema.safeParse(raw);
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
		}

		const rows = await db
			.select({
				sub: subscriptions,
				interval: plans.interval,
			})
			.from(subscriptions)
			.innerJoin(plans, eq(subscriptions.planCode, plans.code))
			.where(eq(subscriptions.id, subId.data))
			.limit(1);
		const row = rows[0];
		if (!row) return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });

		const sub = row.sub;
		if (sub.razorpaySubscriptionId && process.env.ADMIN_BILLING_FORCE_RENEW_RZP !== "1") {
			return NextResponse.json(
				{
					error:
						"Razorpay-linked subscription: renewal must go through billing webhooks. Set ADMIN_BILLING_FORCE_RENEW_RZP=1 only for controlled break-glass.",
				},
				{ status: 400, headers: adminHeaders() },
			);
		}

		const now = new Date();
		const anchor = sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
		const newEnd =
			parsed.data.extend_days != null ?
				new Date(anchor.getTime() + parsed.data.extend_days * 86_400_000)
			:	addPlanBillingInterval(anchor, row.interval);

		await db.transaction(async (tx) => {
			await tx
				.update(subscriptions)
				.set({ currentPeriodEnd: newEnd, updatedAt: now })
				.where(eq(subscriptions.id, sub.id));

			const latest = await tx
				.select({ id: usagePeriods.id })
				.from(usagePeriods)
				.where(eq(usagePeriods.subscriptionId, sub.id))
				.orderBy(desc(usagePeriods.periodEnd))
				.limit(1);
			if (latest[0]) {
				await tx.update(usagePeriods).set({ periodEnd: newEnd }).where(eq(usagePeriods.id, latest[0].id));
			}
		});

		await writeAdminAction({
			action: "subscription_force_renew",
			targetType: "subscription",
			targetId: sub.id,
			payload: {
				previous_period_end: sub.currentPeriodEnd.toISOString(),
				new_period_end: newEnd.toISOString(),
				extend_days: parsed.data.extend_days ?? null,
				razorpay_linked: Boolean(sub.razorpaySubscriptionId),
			},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json(
			{ ok: true, current_period_end: newEnd.toISOString() },
			{ headers: adminHeaders() },
		);
	});
}
