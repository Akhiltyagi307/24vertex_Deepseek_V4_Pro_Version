/**
 * Offline-only subscription status edits (`POST …/flip-status`).
 * Razorpay-linked rows must be reconciled via Razorpay + webhooks, not arbitrary DB flips.
 *
 * This list is INTENTIONALLY a subset of the full status vocabulary used by
 * `subscriptions.status` and the webhook handlers. The full vocabulary is
 * (trialing, active, coupon, grace, past_due, paused, cancelled, expired) —
 * see `src/lib/billing/subscription-state-machine.ts`. The flips below cover
 * the cases an operator would manually drive on a row that has no
 * Razorpay subscription attached:
 *   - past_due / paused / coupon are reached only through the Razorpay
 *     pipeline (W4.x) and don't make sense as offline targets.
 */
export const SUBSCRIPTION_STATUSES = ["trialing", "active", "grace", "expired", "cancelled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export function isSubscriptionStatus(s: string): s is SubscriptionStatus {
	return (SUBSCRIPTION_STATUSES as readonly string[]).includes(s);
}

/** Allowed offline `(from → to)` when there is no `razorpay_subscription_id`. */
const OFFLINE_FLIPS: Record<SubscriptionStatus, Set<SubscriptionStatus>> = {
	trialing: new Set(["active", "grace", "expired", "cancelled"]),
	active: new Set(["grace", "expired", "cancelled", "trialing"]),
	grace: new Set(["active", "expired", "cancelled"]),
	expired: new Set(["active", "trialing", "cancelled"]),
	cancelled: new Set(["active", "trialing", "expired"]),
};

export function canFlipSubscriptionStatusOffline(from: string, to: string): boolean {
	if (!isSubscriptionStatus(from) || !isSubscriptionStatus(to)) return false;
	if (from === to) return false;
	return OFFLINE_FLIPS[from].has(to);
}
