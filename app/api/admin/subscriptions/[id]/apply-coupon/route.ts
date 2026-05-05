import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { isCouponSingleUseGlobalExhausted } from "@/lib/billing/coupon-policy";
import { PLAN_CATALOG, tokenQuotaForGrade, type PlanCode } from "@/lib/billing/plans";
import { db } from "@/db";
import { coupons, plans, subscriptions } from "@/db/schema/billing";
import { profiles } from "@/db/schema/profiles";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
	coupon_code: z.string().trim().min(2).max(40),
});

/**
 * Applies a coupon to the subscription's profile using the same atomic RPC as student self-serve.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const subId = z.string().uuid().safeParse(id);
		if (!subId.success) return adminErrorResponse("Invalid subscription id");

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
		const code = parsed.data.coupon_code.toUpperCase();

		const subRows = await db
			.select({
				id: subscriptions.id,
				profileId: subscriptions.profileId,
				status: subscriptions.status,
			})
			.from(subscriptions)
			.where(eq(subscriptions.id, subId.data))
			.limit(1);
		const sub = subRows[0];
		if (!sub) return adminErrorResponse("Not found", { status: 404 });

		if (sub.status === "active" || sub.status === "grace" || sub.status === "past_due") {
			return adminErrorResponse(
				"Subscription is in a paid/active billing state; cancel or wait before stacking a coupon.",
				{ status: 409 },
			);
		}

		const couponRows = await db
			.select()
			.from(coupons)
			.where(eq(coupons.code, code))
			.limit(1);
		const coupon = couponRows[0];
		if (!coupon) return adminErrorResponse("Unknown coupon code", { status: 404 });
		if (coupon.kind === "checkout_discount") {
			return adminErrorResponse(
				"Checkout discount coupons apply at Razorpay subscribe time, not via entitlement apply.",
			);
		}
		if (!coupon.grantsPlanCode) return adminErrorResponse("Coupon has no grants_plan_code");
		if (!coupon.isActive) return adminErrorResponse("Coupon inactive");
		if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
			return adminErrorResponse("Coupon expired");
		}
		if (coupon.redemptionsCount >= coupon.maxRedemptions) {
			return adminErrorResponse("Coupon exhausted", { status: 409 });
		}

		const admin = createServiceRoleClient();
		const { data: alreadyAny } = await admin.from("coupon_redemptions").select("id").eq("coupon_id", coupon.id).maybeSingle();
		if (
			isCouponSingleUseGlobalExhausted({
				singleUseGlobally: Boolean(coupon.singleUseGlobally),
				redemptionsCount: coupon.redemptionsCount,
				anyRedemptionExists: Boolean(alreadyAny),
			})
		) {
			return adminErrorResponse("Single-use coupon already redeemed somewhere", { status: 409 });
		}

		const profileRows = await db.select().from(profiles).where(eq(profiles.id, sub.profileId)).limit(1);
		const profile = profileRows[0];
		if (!profile || profile.role !== "student") {
			return adminErrorResponse("Subscription profile is not a student");
		}

		const planRows = await db.select().from(plans).where(eq(plans.code, coupon.grantsPlanCode)).limit(1);
		const planRow = planRows[0];
		const catalogEntry =
			coupon.grantsPlanCode in PLAN_CATALOG ? PLAN_CATALOG[coupon.grantsPlanCode as PlanCode] : undefined;
		const testsQuota = planRow?.testsPerPeriod ?? catalogEntry?.testsPerPeriod ?? PLAN_CATALOG.pro_monthly.testsPerPeriod;
		const tokenBase =
			planRow ?
				{
					tokensGrade6to10: planRow.tokensGrade6to10,
					tokensGrade11to12: planRow.tokensGrade11to12,
				}
			:	catalogEntry ?? PLAN_CATALOG.pro_monthly;
		const tokensQuota = tokenQuotaForGrade(
			{
				...PLAN_CATALOG.pro_monthly,
				tokensGrade6to10: tokenBase.tokensGrade6to10,
				tokensGrade11to12: tokenBase.tokensGrade11to12,
			},
			profile.grade,
		);

		const { data: redeemRows, error: redeemErr } = await admin.rpc("billing_redeem_coupon_atomic", {
			p_coupon_id: coupon.id,
			p_profile_id: sub.profileId,
			p_plan_code: coupon.grantsPlanCode,
			p_duration_days: coupon.durationDays,
			p_tests_quota: testsQuota,
			p_tokens_quota: tokensQuota,
		});

		if (redeemErr) return adminErrorResponse(redeemErr.message, { status: 500 });
		const redeemRow = Array.isArray(redeemRows) ? redeemRows[0] : redeemRows;
		if (!redeemRow?.ok) {
			const errorCode = String(redeemRow?.error_code ?? "database_error");
			return adminErrorResponse(errorCode, { status: 409 });
		}

		await writeAdminAction({
			action: ADMIN_ACTIONS.SUBSCRIPTION_APPLY_COUPON,
			targetType: "subscription",
			targetId: sub.id,
			payload: { coupon_code: code, subscription_id_rpc: redeemRow.subscription_id },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse({ subscription_id: redeemRow.subscription_id as string });
	});
}
