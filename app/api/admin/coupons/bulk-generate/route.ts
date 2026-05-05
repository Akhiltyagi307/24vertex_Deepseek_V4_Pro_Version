import { randomBytes } from "node:crypto";

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
import { coupons, plans } from "@/db/schema/billing";

export const runtime = "nodejs";

const bodySchema = z.object({
	count: z.number().int().min(1).max(200),
	grants_plan_code: z.string().trim().min(1).max(32),
	duration_days: z.number().int().min(1).max(3650).default(30),
	max_redemptions: z.number().int().min(1).max(1000).default(1),
	code_prefix: z.string().trim().max(12).optional().default(""),
	description: z.string().max(2000).optional().nullable(),
});

function makeCode(prefix: string): string {
	const rand = randomBytes(5).toString("hex").toUpperCase();
	const base = `${prefix}${prefix ? "-" : ""}${rand}`;
	return base.slice(0, 40);
}

/** Creates many single-use (or custom max) coupon rows in one request. */
export async function POST(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

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

		const planOk = await db.select({ code: plans.code }).from(plans).where(eq(plans.code, parsed.data.grants_plan_code)).limit(1);
		if (!planOk[0]) return adminErrorResponse("grants_plan_code not found");

		const prefix = parsed.data.code_prefix.toUpperCase();
		const createdCodes: string[] = [];

		for (let i = 0; i < parsed.data.count; i++) {
			let code = makeCode(prefix);
			let attempts = 0;
			while (attempts < 8) {
				try {
					await db.insert(coupons).values({
						code,
						description: parsed.data.description ?? null,
						maxRedemptions: parsed.data.max_redemptions,
						durationDays: parsed.data.duration_days,
						grantsPlanCode: parsed.data.grants_plan_code,
						expiresAt: null,
						isActive: true,
						createdBy: null,
						kind: "entitlement",
						singleUseGlobally: false,
						discountPercent: null,
						eligiblePlanCodes: null,
						razorpayOffersByPlan: {},
					});
					createdCodes.push(code);
					break;
				} catch {
					attempts += 1;
					code = makeCode(prefix);
				}
			}
			if (attempts >= 8) {
				return adminErrorResponse("Could not allocate unique coupon codes", {
					status: 500,
					details: { partial_codes: createdCodes },
				});
			}
		}

		await writeAdminAction({
			action: ADMIN_ACTIONS.COUPON_BULK_GENERATE,
			targetType: "coupon",
			targetId: parsed.data.grants_plan_code,
			payload: { count: createdCodes.length, grants_plan_code: parsed.data.grants_plan_code, prefix },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse({ codes: createdCodes }, { status: 201 });
	});
}
