import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getApiRequestUser } from "@/lib/auth/api-request-user";
import { quoteCheckoutCouponForPlan } from "@/lib/billing/checkout-coupon";
import { isPlanCode } from "@/lib/billing/plans";
import { rlConsume } from "@/lib/ratelimit/consume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
	planCode: z.enum(["pro_monthly", "pro_annual"]),
	coupon: z.string().trim().min(2).max(40),
});

// W2.1: rate-limit per authenticated user. Without this, an attacker with any
// valid login can iterate codes (combined with structured error codes,
// although those are now unified — see checkout-coupon.ts) to enumerate which
// codes exist. 10/min is plenty for a real user trying a code or two.
const QUOTE_RATE_LIMIT_PER_MIN = 10;
const QUOTE_RATE_WINDOW_SEC = 60;

/**
 * Validates a checkout coupon for a paid plan (no side effects).
 */
export async function GET(req: NextRequest) {
	const auth = await getApiRequestUser(req);
	if (!auth) {
		return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	const rl = await rlConsume({
		key: `quote-coupon:user:${auth.user.id}`,
		limit: QUOTE_RATE_LIMIT_PER_MIN,
		windowSec: QUOTE_RATE_WINDOW_SEC,
	});
	if (!rl.allowed) {
		const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000));
		return NextResponse.json(
			{ ok: false, code: "rate_limited", message: "Too many coupon checks. Slow down." },
			{ status: 429, headers: { "Retry-After": String(retryAfterSec) } },
		);
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
		return NextResponse.json({ ok: false, message: q.message, code: q.code }, { status: 400 });
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
