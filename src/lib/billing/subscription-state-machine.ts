import "server-only";

/**
 * Subscription status state machine.
 *
 * Single source of truth for what statuses exist and what transitions are
 * allowed. Used by:
 *   - the Razorpay webhook processor's atomic state-change helper, to validate
 *     a webhook-driven transition after acquiring a row-level lock (W1.2).
 *   - the user-facing plan-change route (W4.1) before calling Razorpay.
 *   - the pause/resume routes (W4.2).
 *
 * Design notes:
 *
 * 1. **Self-transitions are allowed.** A sub already `active` getting another
 *    `subscription.activated` event must succeed (Razorpay sometimes re-fires
 *    on retries; our dedup catches most but not all). Same for `coupon →
 *    coupon` if a re-redemption ever lands.
 *
 * 2. **Terminal states (`cancelled`, `expired`) cannot be left automatically.**
 *    If Razorpay sends an `activated` event for a sub we already cancelled,
 *    something is wrong (stale delivery, manual reactivation that we didn't
 *    track, attacker replay). We refuse the transition and log; an admin can
 *    manually fix via the billing_events replay UI if it was legitimate.
 *
 * 3. **Unknown status values fail open.** If `from` or `to` isn't a known
 *    status (older row, future status we haven't taught the matrix yet), we
 *    don't block. The webhook still records the event for audit. Hard-blocking
 *    on schema-drift would create incident risk for no real safety gain.
 */

export type SubscriptionStatus =
	| "trialing"
	| "coupon"
	| "active"
	| "grace"
	| "past_due"
	| "cancelled"
	| "expired"
	| "paused";

export class InvalidStateTransitionError extends Error {
	readonly from: string;
	readonly to: string;
	readonly subscriptionId: string | undefined;

	constructor(from: string, to: string, subscriptionId?: string) {
		super(`Invalid subscription state transition: ${from} → ${to}${subscriptionId ? ` (sub ${subscriptionId})` : ""}`);
		this.name = "InvalidStateTransitionError";
		this.from = from;
		this.to = to;
		this.subscriptionId = subscriptionId;
	}
}

const TERMINAL_STATES: ReadonlySet<SubscriptionStatus> = new Set(["cancelled", "expired"]);

const TRANSITION_MATRIX: Record<SubscriptionStatus, ReadonlySet<SubscriptionStatus>> = {
	trialing: new Set<SubscriptionStatus>(["trialing", "active", "coupon", "grace", "past_due", "cancelled", "expired"]),
	coupon: new Set<SubscriptionStatus>(["coupon", "active", "cancelled", "expired"]),
	active: new Set<SubscriptionStatus>(["active", "grace", "past_due", "cancelled", "expired", "paused"]),
	grace: new Set<SubscriptionStatus>(["grace", "active", "past_due", "cancelled", "expired"]),
	past_due: new Set<SubscriptionStatus>(["past_due", "active", "grace", "cancelled", "expired"]),
	paused: new Set<SubscriptionStatus>(["paused", "active", "cancelled", "expired"]),
	cancelled: new Set<SubscriptionStatus>(["cancelled"]),
	expired: new Set<SubscriptionStatus>(["expired"]),
};

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
	return typeof value === "string" && Object.prototype.hasOwnProperty.call(TRANSITION_MATRIX, value);
}

export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
	return TRANSITION_MATRIX[from]?.has(to) ?? false;
}

export function assertTransition(from: string, to: string, subscriptionId?: string): void {
	// Unknown values fail open — see design note 3 above.
	if (!isSubscriptionStatus(from) || !isSubscriptionStatus(to)) return;
	if (!canTransition(from, to)) {
		throw new InvalidStateTransitionError(from, to, subscriptionId);
	}
}

export function isTerminalStatus(status: SubscriptionStatus): boolean {
	return TERMINAL_STATES.has(status);
}
