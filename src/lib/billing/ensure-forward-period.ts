import { addPlanBillingInterval } from "@/lib/billing/add-plan-billing-interval";

/**
 * Guarantees a forward (non-zero-length) billing period (review finding M10).
 *
 * The Razorpay subscription webhook handlers resolve a new period's start/end
 * with fallbacks like `currentEnd ?? ours.current_period_end ?? now`. When the
 * payload omits `current_end`, BOTH start and end could resolve to the same
 * value (`ours.current_period_end`), producing a zero-length window. The
 * entitlement rule treats a period as active only while `period_end > NOW()`,
 * so a zero-length period reads as immediately expired — a student who just
 * paid would show zero quota.
 *
 * When the resolved end is not strictly after the start (zero-length, inverted,
 * or unparseable), derive the end from the plan's catalog interval instead.
 */
export function ensureForwardPeriod(
	periodStartIso: string,
	periodEndIso: string,
	planInterval: string,
): { startIso: string; endIso: string } {
	const start = new Date(periodStartIso);
	const end = new Date(periodEndIso);
	const startOk = Number.isFinite(start.getTime());
	if (startOk && Number.isFinite(end.getTime()) && end.getTime() > start.getTime()) {
		return { startIso: periodStartIso, endIso: periodEndIso };
	}
	const safeStart = startOk ? start : new Date();
	return {
		startIso: safeStart.toISOString(),
		endIso: addPlanBillingInterval(safeStart, planInterval).toISOString(),
	};
}
