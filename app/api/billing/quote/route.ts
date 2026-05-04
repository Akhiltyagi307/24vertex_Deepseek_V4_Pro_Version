import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getApiRequestUser } from "@/lib/auth/api-request-user";
import { quoteCheckoutCouponForPlan } from "@/lib/billing/checkout-coupon";
import { isPlanCode } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
	planCode: z.enum(["pro_monthly", "pro_annual"]),
	coupon: z.string().trim().min(2).max(40),
});

/**
 * Validates a checkout coupon for a paid plan (no side effects).
 */
export async function GET(req: NextRequest) {
	const auth = await getApiRequestUser(req);
	if (!auth) {
		return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	const sp = req.nextUrl.searchParams;
	const parsed = querySchema.safeParse({
		planCode: sp.get("planCode") ?? "",
		coupon: sp.get("coupon") ?? "",
	});
	if (!parsed.success) {
		return NextResponse.json({ ok: false, message: "Invalid query." }, { status: 400 });
	}

	const q = await quoteCheckoutCouponForPlan({
		couponCode: parsed.data.coupon,
		planCode: parsed.data.planCode,
	});
	if (!q.ok) {
		return NextResponse.json({ ok: false, message: q.message }, { status: 400 });
	}
	if (!isPlanCode(q.planCode)) {
		return NextResponse.json({ ok: false, message: "Invalid plan." }, { status: 400 });
	}

	return NextResponse.json({
		ok: true,
		coupon_id: q.couponId,
		plan_code: q.planCode,
		coupon_code: q.couponCode,
		discount_percent: q.discountPercent,
	});
}
