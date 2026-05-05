import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { coupons } from "@/db/schema/billing";

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

		const rows = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
		const row = rows[0];
		if (!row) return adminErrorResponse("Not found", { status: 404 });

		await db.update(coupons).set({ isActive: false }).where(eq(coupons.code, code));

		await writeAdminAction({
			action: ADMIN_ACTIONS.COUPON_DISABLE,
			targetType: "coupon",
			targetId: row.id,
			payload: { code },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
