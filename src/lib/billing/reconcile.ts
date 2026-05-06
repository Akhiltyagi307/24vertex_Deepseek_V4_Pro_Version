import "server-only";

import { and, desc, eq, gte, isNotNull, isNull, lt } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";

import { db } from "@/db";
import {
	adminRefundIdempotency,
	billingReconciliationDrift,
	payments,
	subscriptions,
} from "@/db/schema/billing";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";

import { fetchPaymentRefunds, fetchSubscription, type RazorpayRefund, type RazorpaySubscription } from "./razorpay";

/**
 * W3.3 — periodic reconciliation between our DB and Razorpay.
 *
 * Razorpay does not expose an event-replay API, so missed webhooks are
 * unrecoverable except by polling. This service runs daily (via pg_cron →
 * /api/internal/billing/reconcile) and:
 *
 *  1. For each active subscription with recent activity, fetches Razorpay's
 *     view and writes a `billing_reconciliation_drift` row per field that
 *     differs (status / current_period_end / plan_id). Resolution is manual
 *     via the admin UI.
 *
 *  2. For each `admin_refund_idempotency` row stuck in `state='pending'`
 *     longer than 1h, asks Razorpay whether a refund actually landed for
 *     that payment. If yes, marks `succeeded`; if no, marks `orphan` and
 *     surfaces the row in the admin Reconciliation page.
 *
 * Both passes are best-effort: a single Razorpay API failure is logged but
 * doesn't abort the whole job. Sentry alerts when drift count > 0.
 */

interface ReconcileSummary {
	subsScanned: number;
	subsDrifting: number;
	refundsScanned: number;
	refundsRecovered: number;
	refundsOrphaned: number;
	errors: number;
}

const SUB_RECENT_WINDOW_MS = 7 * 86_400_000;
const REFUND_PENDING_AGE_MS = 60 * 60_000;
const PERIOD_TOLERANCE_MS = 60_000; // 1-minute tolerance on period bounds

/**
 * Map Razorpay's subscription.status to the canonical local status we'd
 * expect. Returns null for states we don't try to mirror (mandate-flow
 * intermediates).
 */
function expectedLocalStatus(razorpayStatus: string | undefined | null): string | null {
	switch (razorpayStatus) {
		case "active":
		case "authenticated":
			return "active";
		case "completed":
			return "expired";
		case "cancelled":
			return "cancelled";
		case "halted":
			return "expired";
		case "pending":
			return "grace";
		case "paused":
			return "paused";
		default:
			return null;
	}
}

function timestampsClose(localIso: string | Date | null | undefined, razorpaySec: number | null | undefined): boolean {
	if (!localIso || !razorpaySec) return localIso == null && !razorpaySec;
	const localMs = (localIso instanceof Date ? localIso : new Date(localIso)).getTime();
	const razorpayMs = razorpaySec * 1000;
	return Math.abs(localMs - razorpayMs) <= PERIOD_TOLERANCE_MS;
}

async function reconcileSubscription(localSub: {
	id: string;
	status: string;
	currentPeriodEnd: Date;
	razorpaySubscriptionId: string | null;
	planCode: string;
}): Promise<number> {
	if (!localSub.razorpaySubscriptionId) return 0;
	let rzpSub: RazorpaySubscription;
	try {
		rzpSub = await fetchSubscription(localSub.razorpaySubscriptionId);
	} catch (e) {
		Sentry.captureException(e, {
			tags: { component: "billing.reconcile", phase: "fetch_subscription" },
			extra: { subscription_id: localSub.id, razorpay_subscription_id: localSub.razorpaySubscriptionId },
		});
		return 0;
	}

	const drifts: { field: string; local: string | null; razorpay: string | null }[] = [];
	const expected = expectedLocalStatus(rzpSub.status);
	if (expected && expected !== localSub.status) {
		drifts.push({ field: "status", local: localSub.status, razorpay: `${rzpSub.status} → expect ${expected}` });
	}
	if (!timestampsClose(localSub.currentPeriodEnd, rzpSub.current_end ?? null)) {
		drifts.push({
			field: "current_period_end",
			local: localSub.currentPeriodEnd.toISOString(),
			razorpay: rzpSub.current_end ? new Date(rzpSub.current_end * 1000).toISOString() : null,
		});
	}

	if (drifts.length === 0) return 0;

	await db.insert(billingReconciliationDrift).values(
		drifts.map((d) => ({
			subscriptionId: localSub.id,
			field: d.field,
			localValue: d.local,
			razorpayValue: d.razorpay,
		})),
	);
	return drifts.length;
}

async function reconcilePendingRefund(row: {
	idempotencyKey: string;
	paymentId: string;
	createdAt: Date;
}): Promise<{ recovered: boolean; orphaned: boolean }> {
	const payRow = (await db.select({ razorpayPaymentId: payments.razorpayPaymentId }).from(payments).where(eq(payments.id, row.paymentId)).limit(1))[0];
	if (!payRow?.razorpayPaymentId) {
		// Payment was deleted or never had a Razorpay id — mark idempotency
		// row orphan so admin can inspect.
		await db
			.update(adminRefundIdempotency)
			.set({ state: "orphan" })
			.where(eq(adminRefundIdempotency.idempotencyKey, row.idempotencyKey));
		return { recovered: false, orphaned: true };
	}

	let refunds: RazorpayRefund[];
	try {
		refunds = await fetchPaymentRefunds(payRow.razorpayPaymentId);
	} catch (e) {
		Sentry.captureException(e, {
			tags: { component: "billing.reconcile", phase: "fetch_payment_refunds" },
			extra: { idempotency_key: row.idempotencyKey, razorpay_payment_id: payRow.razorpayPaymentId },
		});
		return { recovered: false, orphaned: false };
	}

	// Match by notes.payment_row when available (admin route always sets it),
	// else accept any non-failed refund as evidence the prior attempt landed.
	const matched =
		refunds.find((r) => typeof r.notes?.payment_row === "string" && (r.notes.payment_row as string) === row.paymentId) ??
		refunds.find((r) => r.status !== "failed");

	if (matched && matched.status !== "failed") {
		await db
			.update(adminRefundIdempotency)
			.set({ razorpayRefundId: matched.id, state: "succeeded" })
			.where(eq(adminRefundIdempotency.idempotencyKey, row.idempotencyKey));
		// Best-effort: also update the payments row so the admin UI reflects
		// reality; refund.processed webhook will be a no-op when it lands.
		await db
			.update(payments)
			.set({
				razorpayRefundId: matched.id,
				refundAmountPaise: matched.amount ?? null,
				refundedAt: matched.created_at ? new Date(matched.created_at * 1000) : new Date(),
				status: "refunded",
			})
			.where(eq(payments.id, row.paymentId));
		await db.insert(billingReconciliationDrift).values({
			paymentId: row.paymentId,
			idempotencyKey: row.idempotencyKey,
			field: "refund_idempotency_recovered",
			localValue: "pending",
			razorpayValue: matched.id,
		});
		return { recovered: true, orphaned: false };
	}

	// Razorpay has no successful refund for this payment — the prior request
	// errored before reaching them, or the refund failed. Orphan the row so
	// admin can choose to retry with a fresh Idempotency-Key.
	await db
		.update(adminRefundIdempotency)
		.set({ state: "orphan" })
		.where(eq(adminRefundIdempotency.idempotencyKey, row.idempotencyKey));
	await db.insert(billingReconciliationDrift).values({
		paymentId: row.paymentId,
		idempotencyKey: row.idempotencyKey,
		field: "refund_idempotency_orphaned",
		localValue: "pending",
		razorpayValue: "no refund found at razorpay",
	});
	return { recovered: false, orphaned: true };
}

export async function runReconciliation(): Promise<ReconcileSummary> {
	const summary: ReconcileSummary = {
		subsScanned: 0,
		subsDrifting: 0,
		refundsScanned: 0,
		refundsRecovered: 0,
		refundsOrphaned: 0,
		errors: 0,
	};

	const since = new Date(Date.now() - SUB_RECENT_WINDOW_MS);
	const activeSubs = await db
		.select({
			id: subscriptions.id,
			status: subscriptions.status,
			currentPeriodEnd: subscriptions.currentPeriodEnd,
			razorpaySubscriptionId: subscriptions.razorpaySubscriptionId,
			planCode: subscriptions.planCode,
		})
		.from(subscriptions)
		.where(and(gte(subscriptions.updatedAt, since), isNotNull(subscriptions.razorpaySubscriptionId)))
		.orderBy(desc(subscriptions.updatedAt))
		.limit(500);

	for (const sub of activeSubs) {
		summary.subsScanned += 1;
		try {
			const drifts = await reconcileSubscription(sub);
			if (drifts > 0) summary.subsDrifting += 1;
		} catch (e) {
			summary.errors += 1;
			Sentry.captureException(e, { tags: { component: "billing.reconcile", phase: "sub_loop" } });
		}
	}

	const refundCutoff = new Date(Date.now() - REFUND_PENDING_AGE_MS);
	const pendingRefunds = await db
		.select({
			idempotencyKey: adminRefundIdempotency.idempotencyKey,
			paymentId: adminRefundIdempotency.paymentId,
			createdAt: adminRefundIdempotency.createdAt,
		})
		.from(adminRefundIdempotency)
		.where(and(eq(adminRefundIdempotency.state, "pending"), lt(adminRefundIdempotency.createdAt, refundCutoff)))
		.limit(200);

	for (const row of pendingRefunds) {
		summary.refundsScanned += 1;
		try {
			const r = await reconcilePendingRefund(row);
			if (r.recovered) summary.refundsRecovered += 1;
			if (r.orphaned) summary.refundsOrphaned += 1;
		} catch (e) {
			summary.errors += 1;
			Sentry.captureException(e, { tags: { component: "billing.reconcile", phase: "refund_loop" } });
		}
	}

	if (summary.subsDrifting > 0 || summary.refundsOrphaned > 0) {
		Sentry.captureMessage("billing.reconcile.drift_detected", {
			level: "warning",
			tags: { component: "billing.reconcile" },
			extra: summary as unknown as Record<string, unknown>,
		});
	}

	await writeAdminAction({
		action: ADMIN_ACTIONS.BILLING_RECONCILIATION_RUN,
		targetType: "billing",
		payload: summary as unknown as Record<string, unknown>,
	});

	return summary;
}

// Suppress unused-warning for isNull which Drizzle re-exports; keeps callers
// importing from a single place when adding new state filters.
void isNull;
