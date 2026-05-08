import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { couponRedemptions, coupons } from "@/db/schema/billing";

export const runtime = "nodejs";

function normalizeCouponParam(raw: string): string {
	return decodeURIComponent(raw).trim().toUpperCase();
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const code = normalizeCouponParam((await ctx.params).code);
		if (!code) return adminErrorResponse("Invalid code");

		const captured = await db.transaction(async (tx) => {
			const rows = await tx.select().from(coupons).where(eq(coupons.code, code)).limit(1);
			const row = rows[0];
			if (!row) return null;
			const redemptions = await tx
				.select({
					profileId: couponRedemptions.profileId,
					subscriptionId: couponRedemptions.subscriptionId,
					redeemedAt: couponRedemptions.redeemedAt,
					refundedAt: couponRedemptions.refundedAt,
				})
				.from(couponRedemptions)
				.where(eq(couponRedemptions.couponId, row.id));
			await tx.delete(coupons).where(eq(coupons.id, row.id));
			return { row, redemptions };
		});

		if (!captured) return adminErrorResponse("Not found", { status: 404 });

		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.COUPON_DELETE,
			targetType: "coupon",
			targetId: captured.row.id,
			payload: {
				code: captured.row.code,
				kind: captured.row.kind,
				grants_plan_code: captured.row.grantsPlanCode,
				discount_percent: captured.row.discountPercent,
				redemptions_count: captured.row.redemptionsCount,
				max_redemptions: captured.row.maxRedemptions,
				redemptions: captured.redemptions.map((r) => ({
					profile_id: r.profileId,
					subscription_id: r.subscriptionId,
					redeemed_at: r.redeemedAt instanceof Date ? r.redeemedAt.toISOString() : r.redeemedAt,
					refunded_at:
						r.refundedAt instanceof Date ? r.refundedAt.toISOString() : (r.refundedAt ?? null),
				})),
			},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
