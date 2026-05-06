import "server-only";

import { PLAN_CATALOG, type PlanCode } from "./plans";

/**
 * Local proration math for plan changes (W4.1).
 *
 * Razorpay's docs do NOT specify automatic charge-the-difference behavior on
 * `subscriptions.update`. Empirically the next cycle bills at the new plan
 * price; Razorpay does not retroactively bill the prorated upgrade delta.
 *
 * We compute the delta locally for audit + analytics. The dollar amount is
 * recorded in `billing_plan_changes.proration_delta_paise` so support has a
 * trail when a customer asks "did I overpay on the upgrade?". We do NOT
 * automatically charge this delta — that would require a separate checkout
 * flow. The user effectively gets a free time-prorated trial of the upgrade
 * for the remainder of their current cycle.
 *
 * If proration becomes a revenue concern we can:
 *   1. Create a one-off Razorpay order for the delta in change-plan/route.ts
 *   2. Open a separate Razorpay Checkout for the delta
 *   3. Mark proration_payment_id when paid
 * Marking that as a future enhancement (TODO) rather than blocking M3.
 */

export interface ProrationQuote {
	fromPlanCode: PlanCode;
	toPlanCode: PlanCode;
	fromPricePaise: number;
	toPricePaise: number;
	periodTotalSec: number;
	periodRemainingSec: number;
	deltaPaise: number;
	isUpgrade: boolean;
}

export function quotePlanChange(input: {
	fromPlanCode: PlanCode;
	toPlanCode: PlanCode;
	currentPeriodStart: Date;
	currentPeriodEnd: Date;
	now?: Date;
}): ProrationQuote {
	const now = (input.now ?? new Date()).getTime();
	const periodStart = input.currentPeriodStart.getTime();
	const periodEnd = input.currentPeriodEnd.getTime();
	const periodTotalMs = Math.max(1, periodEnd - periodStart);
	const periodRemainingMs = Math.max(0, periodEnd - now);

	const fromPlan = PLAN_CATALOG[input.fromPlanCode];
	const toPlan = PLAN_CATALOG[input.toPlanCode];
	const fromPricePaise = fromPlan?.pricePaise ?? 0;
	const toPricePaise = toPlan?.pricePaise ?? 0;

	// Time-prorated delta: (newPrice - oldPrice) × (remaining / total).
	// Round HALF-UP for positive values so the user doesn't lose paise to
	// floor-rounding; for downgrades (negative delta) we round HALF-UP towards
	// zero (i.e. round() then take abs sign) so credit isn't accidentally
	// inflated.
	const ratio = periodRemainingMs / periodTotalMs;
	const rawDelta = (toPricePaise - fromPricePaise) * ratio;
	const deltaPaise = Math.round(rawDelta);

	return {
		fromPlanCode: input.fromPlanCode,
		toPlanCode: input.toPlanCode,
		fromPricePaise,
		toPricePaise,
		periodTotalSec: Math.floor(periodTotalMs / 1000),
		periodRemainingSec: Math.floor(periodRemainingMs / 1000),
		deltaPaise,
		isUpgrade: toPricePaise > fromPricePaise,
	};
}

export function defaultWhenForChange(
	fromPlanCode: PlanCode,
	toPlanCode: PlanCode,
): "now" | "cycle_end" {
	const fromPaise = PLAN_CATALOG[fromPlanCode]?.pricePaise ?? 0;
	const toPaise = PLAN_CATALOG[toPlanCode]?.pricePaise ?? 0;
	// Upgrades default to immediate (user wants new features now); downgrades
	// default to cycle_end (don't shorten what they already paid for).
	return toPaise >= fromPaise ? "now" : "cycle_end";
}
