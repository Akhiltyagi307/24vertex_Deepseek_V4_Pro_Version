import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminDetailResponse, adminErrorResponse, adminListResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { coupons, plans } from "@/db/schema/billing";

export const runtime = "nodejs";

const couponBase = z.object({
	code: z.string().trim().min(2).max(40),
	description: z.string().max(2000).optional().nullable(),
	max_redemptions: z.number().int().positive().max(1_000_000),
	expires_at: z.string().datetime().optional().nullable(),
});

const entitlementCreate = couponBase.extend({
	kind: z.literal("entitlement"),
	grants_plan_code: z.string().trim().min(1).max(32),
	duration_days: z.number().int().min(1).max(3650).default(30),
	single_use_globally: z.boolean().optional().default(false),
});

const checkoutCreate = couponBase.extend({
	kind: z.literal("checkout_discount"),
	discount_percent: z.number().int().min(1).max(100),
	eligible_plan_codes: z.array(z.enum(["pro_monthly", "pro_annual"])).max(2).nullable().optional(),
	duration_days: z.number().int().min(0).max(3650).default(0),
});

const createSchema = z.discriminatedUnion("kind", [entitlementCreate, checkoutCreate]);

function serializeCoupon(r: (typeof coupons.$inferSelect) | undefined) {
	if (!r) return null;
	return {
		id: r.id,
		code: r.code,
		description: r.description,
		max_redemptions: r.maxRedemptions,
		redemptions_count: r.redemptionsCount,
		duration_days: r.durationDays,
		grants_plan_code: r.grantsPlanCode,
		expires_at: r.expiresAt?.toISOString() ?? null,
		is_active: r.isActive,
		created_at: r.createdAt.toISOString(),
		kind: r.kind,
		single_use_globally: r.singleUseGlobally,
		discount_percent: r.discountPercent,
		eligible_plan_codes: r.eligiblePlanCodes,
		razorpay_offers_by_plan: r.razorpayOffersByPlan,
	};
}

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const sp = request.nextUrl.searchParams;
		const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
		const pageSize = Math.min(200, Math.max(1, Number(sp.get("page_size") ?? "50") || 50));
		const offset = (page - 1) * pageSize;
		const q = sp.get("q")?.trim();

		const conditions: SQL[] = [];
		if (q) {
			const pattern = `%${q.replace(/%/g, "\\%")}%`;
			conditions.push(or(ilike(coupons.code, pattern), ilike(coupons.description, pattern))!);
		}
		const whereSql = conditions.length ? and(...conditions) : undefined;

		const listBase = db.select().from(coupons);
		const listFiltered = whereSql ? listBase.where(whereSql) : listBase;
		const rows = await listFiltered.orderBy(desc(coupons.createdAt)).limit(pageSize).offset(offset);

		const countBase = db.select({ total: count() }).from(coupons);
		const countFiltered = whereSql ? countBase.where(whereSql) : countBase;
		const [{ total }] = await countFiltered;

		return adminListResponse({
			data: rows.map((r) => serializeCoupon(r)!),
			total: Number(total ?? 0),
			page,
			pageSize,
		});
	});
}

export async function POST(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return adminErrorResponse("Invalid JSON");
		}
		const parsed = createSchema.safeParse(body);
		if (!parsed.success) {
			return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
		}

		const code = parsed.data.code.toUpperCase();
		const expiresAt = parsed.data.expires_at ? new Date(parsed.data.expires_at) : null;
		if (expiresAt && Number.isNaN(expiresAt.getTime())) {
			return adminErrorResponse("Invalid expires_at");
		}

		if (parsed.data.kind === "entitlement") {
			const planRows = await db.select({ code: plans.code }).from(plans).where(eq(plans.code, parsed.data.grants_plan_code)).limit(1);
			if (!planRows[0]) return adminErrorResponse("grants_plan_code not found");
		}

		let inserted;
		try {
			if (parsed.data.kind === "entitlement") {
				inserted = await db
					.insert(coupons)
					.values({
						code,
						description: parsed.data.description ?? null,
						maxRedemptions: parsed.data.max_redemptions,
						durationDays: parsed.data.duration_days,
						grantsPlanCode: parsed.data.grants_plan_code,
						expiresAt,
						isActive: true,
						createdBy: null,
						kind: "entitlement",
						singleUseGlobally: parsed.data.single_use_globally,
						discountPercent: null,
						eligiblePlanCodes: null,
						razorpayOffersByPlan: {},
					})
					.returning();
			} else {
				inserted = await db
					.insert(coupons)
					.values({
						code,
						description: parsed.data.description ?? null,
						maxRedemptions: parsed.data.max_redemptions,
						durationDays: parsed.data.duration_days,
						grantsPlanCode: null,
						expiresAt,
						isActive: true,
						createdBy: null,
						kind: "checkout_discount",
						singleUseGlobally: false,
						discountPercent: parsed.data.discount_percent,
						eligiblePlanCodes: parsed.data.eligible_plan_codes ?? null,
						razorpayOffersByPlan: {},
					})
					.returning();
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			if (/unique|duplicate/i.test(msg)) {
				return adminErrorResponse("Coupon code already exists", { status: 409 });
			}
			throw e;
		}

		const row = inserted[0];
		if (!row) return adminErrorResponse("Insert failed", { status: 500 });

		await writeAdminAction({
			action: ADMIN_ACTIONS.COUPON_CREATE,
			targetType: "coupon",
			targetId: row.id,
			payload: {
				code: row.code,
				kind: row.kind,
				grants_plan_code: row.grantsPlanCode,
				discount_percent: row.discountPercent,
			},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminDetailResponse(serializeCoupon(row), { status: 201 });
	});
}
