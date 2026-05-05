import { eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { coupons, plans } from "@/db/schema/billing";
import { PAID_CHECKOUT_PLAN_CODES, type PlanCode } from "@/lib/billing/plans";
import { createSubscriptionPercentOffer } from "@/lib/billing/razorpay-subscription-offers";
import { logServerError } from "@/lib/server/log-supabase-error";

export const runtime = "nodejs";

function normalizeCouponParam(raw: string): string {
	return decodeURIComponent(raw).trim().toUpperCase();
}

/** Creates Razorpay subscription offers per eligible paid plan and stores `razorpay_offers_by_plan`. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const code = normalizeCouponParam((await ctx.params).code);
		if (!code) return adminErrorResponse("Invalid code");

		const rows = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
		const row = rows[0];
		if (!row) return adminErrorResponse("Not found", { status: 404 });
		if (row.kind !== "checkout_discount") {
			return adminErrorResponse("Only checkout_discount coupons can sync Razorpay offers.");
		}
		const pct = row.discountPercent;
		if (pct == null || pct < 1 || pct > 100) {
			return adminErrorResponse("Coupon discount_percent is invalid.");
		}

		const eligible: PlanCode[] = row.eligiblePlanCodes?.length
			? row.eligiblePlanCodes.filter((c): c is PlanCode => PAID_CHECKOUT_PLAN_CODES.includes(c as PlanCode))
			: [...PAID_CHECKOUT_PLAN_CODES];
		if (eligible.length === 0) {
			return adminErrorResponse("No eligible paid plans for this coupon.");
		}

		const targets = await db
			.select({ code: plans.code, razorpayPlanId: plans.razorpayPlanId, interval: plans.interval })
			.from(plans)
			.where(inArray(plans.code, eligible));

		const map: Record<string, string> = { ...(row.razorpayOffersByPlan ?? {}) };

		for (const p of targets) {
			if (!p.razorpayPlanId) {
				return adminErrorResponse(`Plan ${p.code} has no razorpay_plan_id. Seed Razorpay plans first.`);
			}
			try {
				const created = await createSubscriptionPercentOffer({
					name: `${row.code} ${pct}% · ${p.code}`,
					razorpayPlanId: p.razorpayPlanId,
					percentOff: pct,
					planInterval: p.interval,
				});
				map[p.code] = created.id;
			} catch (e) {
				logServerError("admin.coupon.sync_rzp_offer", e, { planCode: p.code });
				return adminErrorResponse(
					`Razorpay offer create failed for ${p.code}: ${e instanceof Error ? e.message : String(e)}`,
					{ status: 502 },
				);
			}
		}

		await db.update(coupons).set({ razorpayOffersByPlan: map }).where(eq(coupons.id, row.id));

		// Strict audit: each iteration above mutated Razorpay (created an
		// offer). Missing audit row leaves us unable to attribute who created
		// which offer.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.COUPON_SYNC_RAZORPAY_OFFERS,
			targetType: "coupon",
			targetId: row.id,
			payload: { code: row.code, plan_codes: Object.keys(map) },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse({ razorpay_offers_by_plan: map });
	});
}
