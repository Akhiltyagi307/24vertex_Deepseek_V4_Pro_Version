/**
 * Offline-only subscription status edits (`POST …/flip-status`).
 * Razorpay-linked rows must be reconciled via Razorpay + webhooks, not arbitrary DB flips.
 *
 * Status vocabulary matches `subscriptions.status` / webhook handlers: trialing, active, grace, expired, cancelled.
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
