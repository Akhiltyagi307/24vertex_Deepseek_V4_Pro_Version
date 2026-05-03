import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { db } from "@/db";
import { coupons } from "@/db/schema/billing";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

function normalizeCouponParam(raw: string): string {
	return decodeURIComponent(raw).trim().toUpperCase();
}

const patchSchema = z.object({
	description: z.string().max(2000).optional().nullable(),
	max_redemptions: z.number().int().positive().max(1_000_000).optional(),
	duration_days: z.number().int().min(0).max(3650).optional(),
	expires_at: z.string().datetime().nullish(),
	is_active: z.boolean().optional(),
	single_use_globally: z.boolean().optional(),
	discount_percent: z.number().int().min(1).max(100).optional(),
	eligible_plan_codes: z.array(z.enum(["pro_monthly", "pro_annual"])).max(2).nullable().optional(),
	razorpay_offers_by_plan: z.record(z.string().min(1).max(40)).optional(),
});

export async function GET(_request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const code = normalizeCouponParam((await ctx.params).code);
		if (!code) {
			return NextResponse.json({ error: "Invalid code" }, { status: 400, headers: adminHeaders() });
		}

		const rows = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
		const row = rows[0];
		if (!row) return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });

		return NextResponse.json(
			{
				data: {
					id: row.id,
					code: row.code,
					description: row.description,
					max_redemptions: row.maxRedemptions,
					redemptions_count: row.redemptionsCount,
					duration_days: row.durationDays,
					grants_plan_code: row.grantsPlanCode,
					expires_at: row.expiresAt?.toISOString() ?? null,
					is_active: row.isActive,
					created_at: row.createdAt.toISOString(),
					kind: row.kind,
					single_use_globally: row.singleUseGlobally,
					discount_percent: row.discountPercent,
					eligible_plan_codes: row.eligiblePlanCodes,
					razorpay_offers_by_plan: row.razorpayOffersByPlan,
				},
			},
			{ headers: adminHeaders() },
		);
	});
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const code = normalizeCouponParam((await ctx.params).code);
		if (!code) {
			return NextResponse.json({ error: "Invalid code" }, { status: 400, headers: adminHeaders() });
		}

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
		}
		const parsed = patchSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
		}
		if (Object.keys(parsed.data).length === 0) {
			return NextResponse.json({ error: "No fields to update" }, { status: 400, headers: adminHeaders() });
		}

		const rows = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
		if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });

		const p = parsed.data;
		const expiresAt =
			p.expires_at === undefined ? undefined
			: p.expires_at === null ? null
			: new Date(p.expires_at);
		if (expiresAt && Number.isNaN(expiresAt.getTime())) {
			return NextResponse.json({ error: "Invalid expires_at" }, { status: 400, headers: adminHeaders() });
		}

		if (rows[0].redemptionsCount > 0) {
			if (p.discount_percent != null || p.eligible_plan_codes !== undefined || p.razorpay_offers_by_plan != null) {
				return NextResponse.json(
					{ error: "Cannot change discount or offer map after redemptions exist." },
					{ status: 400, headers: adminHeaders() },
				);
			}
		}

		if (rows[0].kind === "entitlement" && p.duration_days != null && p.duration_days < 1) {
			return NextResponse.json({ error: "duration_days must be at least 1 for entitlement coupons." }, { status: 400, headers: adminHeaders() });
		}
		if (
			rows[0].kind === "checkout_discount" &&
			p.eligible_plan_codes !== undefined &&
			Array.isArray(p.eligible_plan_codes) &&
			p.eligible_plan_codes.length === 0
		) {
			return NextResponse.json(
				{ error: "eligible_plan_codes cannot be empty; pick at least one paid plan or omit the field." },
				{ status: 400, headers: adminHeaders() },
			);
		}

		await db
			.update(coupons)
			.set({
				...(p.description !== undefined ? { description: p.description } : {}),
				...(p.max_redemptions != null ? { maxRedemptions: p.max_redemptions } : {}),
				...(p.duration_days != null ? { durationDays: p.duration_days } : {}),
				...(p.expires_at !== undefined ? { expiresAt } : {}),
				...(p.is_active != null ? { isActive: p.is_active } : {}),
				...(p.single_use_globally != null ? { singleUseGlobally: p.single_use_globally } : {}),
				...(p.discount_percent != null ? { discountPercent: p.discount_percent } : {}),
				...(p.eligible_plan_codes !== undefined ? { eligiblePlanCodes: p.eligible_plan_codes } : {}),
				...(p.razorpay_offers_by_plan != null ? { razorpayOffersByPlan: p.razorpay_offers_by_plan } : {}),
			})
			.where(eq(coupons.code, code));

		await writeAdminAction({
			action: "coupon_patch",
			targetType: "coupon",
			targetId: rows[0].id,
			payload: { code, patch: p },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		const next = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
		const n = next[0];
		if (!n) return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
		return NextResponse.json(
			{
				data: {
					id: n.id,
					code: n.code,
					description: n.description,
					max_redemptions: n.maxRedemptions,
					redemptions_count: n.redemptionsCount,
					duration_days: n.durationDays,
					grants_plan_code: n.grantsPlanCode,
					expires_at: n.expiresAt?.toISOString() ?? null,
					is_active: n.isActive,
					created_at: n.createdAt.toISOString(),
					kind: n.kind,
					single_use_globally: n.singleUseGlobally,
					discount_percent: n.discountPercent,
					eligible_plan_codes: n.eligiblePlanCodes,
					razorpay_offers_by_plan: n.razorpayOffersByPlan,
				},
			},
			{ headers: adminHeaders() },
		);
	});
}
