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
	| { ok: false; message: string; code: CheckoutCouponDenialCode };

/**
 * Stable, machine-readable denial codes for tests + admin tooling. The
 * user-visible `message` is intentionally collapsed to prevent code
 * enumeration (W2.1) — only the structured `code` distinguishes between
 * "coupon doesn't exist", "coupon expired", "coupon inactive", etc.
 */
export type CheckoutCouponDenialCode =
	| "invalid_input"
	| "invalid_or_unavailable" // unified bucket: invalid_code | wrong_kind | inactive | expired | misconfigured | not_synced
	| "exhausted" // user-actionable: tell them the coupon is fully claimed
	| "ineligible_plan"; // user-actionable: prompt them to pick the eligible plan

const GENERIC_INVALID_MESSAGE =
	"This coupon code isn't valid for the selected plan." as const;

/**
 * Validates a checkout_discount coupon for a paid plan and returns the Razorpay `offer_id`
 * to pass to `subscriptions.create`.
 *
 * W2.1: error messages for "doesn't exist / expired / inactive / wrong-kind /
 * misconfigured / not-synced-to-razorpay" are deliberately collapsed into a
 * single message so an authenticated attacker can't enumerate which codes
 * exist by diffing responses. The structured `code` field still distinguishes
 * the cases for our own logging and tests. `exhausted` and `ineligible_plan`
 * stay distinct because they're user-actionable and don't enable enumeration
 * any more than the consolidated message does.
 */
export async function quoteCheckoutCouponForPlan(input: {
	couponCode: string;
	planCode: string;
}): Promise<CheckoutCouponQuote> {
	const code = input.couponCode.trim().toUpperCase();
	if (!code || code.length > 40) {
		return { ok: false, message: "Enter a valid coupon code.", code: "invalid_input" };
	}
	if (!isPlanCode(input.planCode) || !PAID_CHECKOUT_PLAN_CODES.includes(input.planCode)) {
		return { ok: false, message: "Invalid plan for checkout coupon.", code: "invalid_input" };
	}

	const rows = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
	const c = rows[0];
	if (!c) {
		return { ok: false, message: GENERIC_INVALID_MESSAGE, code: "invalid_or_unavailable" };
	}
	if (c.kind !== "checkout_discount") {
		return { ok: false, message: GENERIC_INVALID_MESSAGE, code: "invalid_or_unavailable" };
	}
	if (!c.isActive) {
		return { ok: false, message: GENERIC_INVALID_MESSAGE, code: "invalid_or_unavailable" };
	}
	if (c.expiresAt && c.expiresAt.getTime() < Date.now()) {
		return { ok: false, message: GENERIC_INVALID_MESSAGE, code: "invalid_or_unavailable" };
	}
	if (c.redemptionsCount >= c.maxRedemptions) {
		return {
			ok: false,
			message: "This coupon has been fully redeemed.",
			code: "exhausted",
		};
	}
	const pct = c.discountPercent;
	if (pct == null || pct < 1 || pct > 100) {
		return { ok: false, message: GENERIC_INVALID_MESSAGE, code: "invalid_or_unavailable" };
	}

	const eligible = c.eligiblePlanCodes;
	if (eligible?.length && !eligible.includes(input.planCode)) {
		return {
			ok: false,
			message: "This coupon does not apply to the selected plan.",
			code: "ineligible_plan",
		};
	}

	const map = c.razorpayOffersByPlan ?? {};
	const offerId = typeof map[input.planCode] === "string" ? map[input.planCode]!.trim() : "";
	if (!offerId) {
		// "Not synced to Razorpay" is operator misconfiguration — treat as
		// invalid-or-unavailable from the user's perspective. The admin tool
		// surfaces this via a separate panel, not via user-facing errors.
		return { ok: false, message: GENERIC_INVALID_MESSAGE, code: "invalid_or_unavailable" };
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
