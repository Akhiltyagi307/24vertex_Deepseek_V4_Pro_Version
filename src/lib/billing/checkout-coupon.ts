import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { coupons } from "@/db/schema/billing";

import { PAID_CHECKOUT_PLAN_CODES, type PlanCode, isPlanCode } from "./plans";

export type CheckoutCouponQuote =
	| {
			ok: true;
			couponId: string;
			couponCode: string;
			planCode: PlanCode;
			discountPercent: number;
			offerId: string;
	  }
	| { ok: false; message: string };

/**
 * Validates a checkout_discount coupon for a paid plan and returns the Razorpay `offer_id`
 * to pass to `subscriptions.create`.
 */
export async function quoteCheckoutCouponForPlan(input: {
	couponCode: string;
	planCode: string;
}): Promise<CheckoutCouponQuote> {
	const code = input.couponCode.trim().toUpperCase();
	if (!code || code.length > 40) {
		return { ok: false, message: "Enter a valid coupon code." };
	}
	if (!isPlanCode(input.planCode) || !PAID_CHECKOUT_PLAN_CODES.includes(input.planCode)) {
		return { ok: false, message: "Invalid plan for checkout coupon." };
	}

	const rows = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
	const c = rows[0];
	if (!c) {
		return { ok: false, message: "This coupon code is not recognised." };
	}
	if (c.kind !== "checkout_discount") {
		return { ok: false, message: "This code is not valid for checkout." };
	}
	if (!c.isActive) {
		return { ok: false, message: "This coupon is no longer active." };
	}
	if (c.expiresAt && c.expiresAt.getTime() < Date.now()) {
		return { ok: false, message: "This coupon has expired." };
	}
	if (c.redemptionsCount >= c.maxRedemptions) {
		return { ok: false, message: "This coupon has been fully redeemed." };
	}
	const pct = c.discountPercent;
	if (pct == null || pct < 1 || pct > 100) {
		return { ok: false, message: "This coupon is misconfigured (discount)." };
	}

	const eligible = c.eligiblePlanCodes;
	if (eligible?.length && !eligible.includes(input.planCode)) {
		return { ok: false, message: "This coupon does not apply to the selected plan." };
	}

	const map = c.razorpayOffersByPlan ?? {};
	const offerId = typeof map[input.planCode] === "string" ? map[input.planCode]!.trim() : "";
	if (!offerId) {
		return {
			ok: false,
			message:
				"This coupon is not linked to Razorpay yet. Open the coupon in Admin and run “Sync Razorpay offers”.",
		};
	}

	return {
		ok: true,
		couponId: c.id,
		couponCode: code,
		planCode: input.planCode,
		discountPercent: pct,
		offerId,
	};
}
