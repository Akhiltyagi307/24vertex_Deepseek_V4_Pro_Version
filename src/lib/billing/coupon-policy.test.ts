import { describe, expect, it } from "vitest";

import { isCouponSingleUseGlobalExhausted } from "@/lib/billing/coupon-policy";
import { PAID_CHECKOUT_PLAN_CODES } from "@/lib/billing/plans";

describe("isCouponSingleUseGlobalExhausted", () => {
	it("allows multi-redeem campaigns when single_use_globally is false", () => {
		expect(
			isCouponSingleUseGlobalExhausted({
				singleUseGlobally: false,
				redemptionsCount: 5,
				anyRedemptionExists: true,
			}),
		).toBe(false);
	});

	it("allows redemption only when no prior redemption exists (strict)", () => {
		expect(
			isCouponSingleUseGlobalExhausted({
				singleUseGlobally: true,
				redemptionsCount: 0,
				anyRedemptionExists: false,
			}),
		).toBe(false);
	});

	it("blocks strict coupon when any redemption row already exists", () => {
		expect(
			isCouponSingleUseGlobalExhausted({
				singleUseGlobally: true,
				redemptionsCount: 0,
				anyRedemptionExists: true,
			}),
		).toBe(true);
	});

	it("blocks strict coupon when counter indicates prior use", () => {
		expect(
			isCouponSingleUseGlobalExhausted({
				singleUseGlobally: true,
				redemptionsCount: 1,
				anyRedemptionExists: false,
			}),
		).toBe(true);
	});
});

describe("PAID_CHECKOUT_PLAN_CODES", () => {
	it("includes Razorpay-backed paid tiers", () => {
		expect(PAID_CHECKOUT_PLAN_CODES).toEqual(["pro_monthly", "pro_annual"]);
	});
});
