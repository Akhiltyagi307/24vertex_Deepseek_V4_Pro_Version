export type CouponSingleUseInput = {
	/** When true, at most one redemption row may exist for the coupon (legacy / strict campaigns). */
	singleUseGlobally: boolean;
	redemptionsCount: number;
	anyRedemptionExists: boolean;
};

/** True when a global single-use coupon already has a redemption (DB trigger mirrors this when enabled). */
export function isCouponSingleUseGlobalExhausted(input: CouponSingleUseInput): boolean {
	if (!input.singleUseGlobally) return false;
	return input.anyRedemptionExists || input.redemptionsCount > 0;
}
