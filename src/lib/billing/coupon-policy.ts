export type CouponSingleUseInput = {
	redemptionsCount: number;
	anyRedemptionExists: boolean;
};

/** Product policy: coupon tokens are single-use globally. */
export function isCouponSingleUseGlobalExhausted(input: CouponSingleUseInput): boolean {
	return input.anyRedemptionExists || input.redemptionsCount > 0;
}
