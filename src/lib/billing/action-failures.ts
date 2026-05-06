import "server-only";

/**
 * Canonical `kind` values for the `billing_action_failures` table. Code that
 * inserts into this table must use one of these constants — matches the
 * pattern in lib/admin/audit-actions.ts so failures stay greppable and the
 * admin UI's per-kind retry handler can switch exhaustively.
 *
 * Add a new kind here AND register a retry handler in the retry route
 * (app/api/admin/billing/action-failures/[id]/retry/route.ts) before emitting
 * the new kind from production code.
 */
export const BILLING_ACTION_FAILURE_KINDS = {
	/** RPC `billing_apply_checkout_coupon_redemption_atomic` failed during webhook handling. */
	COUPON_REDEMPTION: "coupon_redemption",
	/** Razorpay sub-creation failed after the customer was created — orphan in Razorpay. (W4.4) */
	ORPHAN_CUSTOMER: "orphan_customer",
	/** Sync-to-Razorpay-offers loop failed midway; offer ids exist in Razorpay but not yet linked. (W3.4) */
	SYNC_OFFERS_PARTIAL: "sync_offers_partial",
	/** Webhook-side email send failed; the receipt/activation/dunning never reached the user. (W5.2) */
	EMAIL: "email",
	/** Coupon-redemption rollback after refund failed (W3.2). */
	REFUND_COUPON_ROLLBACK: "refund_coupon_rollback",
} as const;

export type BillingActionFailureKind =
	(typeof BILLING_ACTION_FAILURE_KINDS)[keyof typeof BILLING_ACTION_FAILURE_KINDS];

export const BILLING_ACTION_FAILURE_KIND_NAMES: ReadonlySet<BillingActionFailureKind> = new Set<BillingActionFailureKind>(
	Object.values(BILLING_ACTION_FAILURE_KINDS),
);

export function isBillingActionFailureKind(value: string): value is BillingActionFailureKind {
	return BILLING_ACTION_FAILURE_KIND_NAMES.has(value as BillingActionFailureKind);
}
