import { describe, expect, it } from "vitest";

import { isCouponSingleUseGlobalExhausted } from "@/lib/billing/coupon-policy";

describe("isCouponSingleUseGlobalExhausted", () => {
	it("allows redemption only when no prior redemption exists", () => {
		expect(
			isCouponSingleUseGlobalExhausted({
				redemptionsCount: 0,
				anyRedemptionExists: false,
			}),
		).toBe(false);
	});

	it("blocks redemption when any redemption row already exists", () => {
		expect(
			isCouponSingleUseGlobalExhausted({
				redemptionsCount: 0,
				anyRedemptionExists: true,
			}),
		).toBe(true);
	});

	it("blocks redemption when counter indicates prior use", () => {
		expect(
			isCouponSingleUseGlobalExhausted({
				redemptionsCount: 1,
				anyRedemptionExists: false,
			}),
		).toBe(true);
	});
});
