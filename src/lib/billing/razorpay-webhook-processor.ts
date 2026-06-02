import "server-only";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { subscriptions as subscriptionsTbl, usagePeriods as usagePeriodsTbl } from "@/db/schema/billing";
import { fetchInvoice } from "@/lib/billing/razorpay";
import { isPlanCode, PLAN_CATALOG, tokenQuotaForGrade, type PlanCode, type PlanCatalogEntry } from "@/lib/billing/plans";
import { ensureForwardPeriod } from "@/lib/billing/ensure-forward-period";
import { parsePrePauseQuota } from "@/lib/billing/pre-pause-quota";
import { assertTransition } from "@/lib/billing/subscription-state-machine";
import {
	sendPaymentFailedEmail,
	sendPaymentReceiptEmail,
	sendSubscriptionActiveEmail,
} from "@/lib/email/subscription-notifications";
import { getNotificationPrefs, isEmailAllowed } from "@/lib/notifications/prefs";
import { logServerError } from "@/lib/server/log-supabase-error";
import type { ServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Centralized pref check for Razorpay webhook emails. Today the master switch
 * (`enable_email_notifications`) gates everything — payment-failed, receipts,
 * activations. A finer-grained `subscription_billing` opt-in (so users can
 * mute receipts but still receive payment-failed) is on the backlog. We use
 * the existing `system` bucket so any user who muted system mail (the only
 * key meaningful here today) still skips these.
 */
async function isBillingEmailAllowedFor(profileId: string): Promise<boolean> {
	const prefs = await getNotificationPrefs(profileId);
	return isEmailAllowed(prefs, "system");
}
export type RazorpayWebhookBody = {
	event: string;
	payload: Record<string, { entity: Record<string, unknown> }>;
	id?: string;
};

type SubscriptionOurs = {
	id: string;
	profile_id: string;
	plan_code: string | null;
	pending_plan_code: string | null;
	current_period_end: string | null;
};

type ProfileRow = { id: string; grade: number | null; full_name: string | null };

type WebhookHandlerContext = {
	admin: ServiceRoleClient;
	eventName: string;
	/** Razorpay's `body.id` (top-level event id). May be null on legacy/test fixtures. */
	razorpayEventId: string | null;
	subscriptionId: string;
	ours: SubscriptionOurs;
	profile: ProfileRow | null;
	studentEmail: string | null;
	subEntity: Record<string, unknown> | null;
	paymentEntity: Record<string, unknown> | null;
	invoiceEntity: Record<string, unknown> | null;
	targetPlanCode: PlanCode;
	targetPlan: PlanCatalogEntry;
	currentStart: string | null;
	currentEnd: string | null;
};

function iso(epochSec: number | null | undefined): string | null {
	if (!epochSec || Number.isNaN(epochSec)) return null;
	return new Date(epochSec * 1000).toISOString();
}

function formatInrPaise(paise: number): string {
	return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}

/**
 * Records checkout_discount redemption once (idempotent) when notes carry
 * `vertex24_coupon_id`. RPC failure is logged to `billing_action_failures` so
 * an admin can retry from the action-failures admin page (W1.4) — previously
 * a failure dropped silently with only a context-poor Sentry warning.
 *
 * Returns a discriminated outcome (mostly for tests + future telemetry).
 */
type CouponRedemptionOutcome =
	| { status: "no_coupon" }
	| { status: "applied" }
	| { status: "duplicate" }
	| { status: "failed"; reason: string };

async function maybeApplyCheckoutCouponRedemption(
	admin: ServiceRoleClient,
	input: { profileId: string; ourSubscriptionId: string; notesUnknown: unknown; razorpayEventId?: string | null },
): Promise<CouponRedemptionOutcome> {
	const notes = input.notesUnknown as Record<string, unknown> | undefined;
	const raw =
		notes?.vertex24_coupon_id ??
		notes?.eduai_coupon_id ??
		notes?.vertex24_coupon ??
		notes?.eduai_coupon;
	const couponId = typeof raw === "string" && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
	if (!couponId) return { status: "no_coupon" };

	const { data, error } = await admin.rpc("billing_apply_checkout_coupon_redemption_atomic", {
		p_coupon_id: couponId,
		p_profile_id: input.profileId,
		p_our_subscription_id: input.ourSubscriptionId,
	});

	if (error) {
		Sentry.captureMessage("billing.webhook.coupon_redemption_rpc_failed", {
			level: "warning",
			tags: { component: "billing.webhook", phase: "coupon_redemption" },
			extra: {
				coupon_id: couponId,
				profile_id: input.profileId,
				our_subscription_id: input.ourSubscriptionId,
				rpc_error: error.message,
			},
		});
		await admin.from("billing_action_failures").insert({
			kind: "coupon_redemption",
			coupon_id: couponId,
			profile_id: input.profileId,
			subscription_id: input.ourSubscriptionId,
			razorpay_event_id: input.razorpayEventId ?? null,
			error_message: `coupon_redemption_atomic: ${error.message}`,
			payload: { rpc_args: { p_coupon_id: couponId, p_profile_id: input.profileId, p_our_subscription_id: input.ourSubscriptionId } },
		});
		return { status: "failed", reason: error.message };
	}
	const row = (Array.isArray(data) ? data[0] : data) as { ok?: boolean; applied?: boolean } | undefined;
	if (row?.ok && row.applied) {
		await admin.from("practice_analytics_events").insert({
			student_id: input.profileId,
			event_name: "coupon_redeemed",
			props: { checkout_discount: true, coupon_id: couponId },
		});
		return { status: "applied" };
	}
	return { status: "duplicate" };
}

/**
 * Hosted invoice short URL from webhook payloads or Razorpay Invoices API.
 */
async function resolveInvoiceShortUrl(
	paymentEntity: Record<string, unknown> | null,
	invoiceEntity: Record<string, unknown> | null,
): Promise<string | null> {
	const fromPayment = paymentEntity?.short_url;
	if (typeof fromPayment === "string" && fromPayment.length > 0) return fromPayment;
	const fromInvoice = invoiceEntity?.short_url;
	if (typeof fromInvoice === "string" && fromInvoice.length > 0) return fromInvoice;
	const invoiceIdRaw = paymentEntity?.invoice_id ?? invoiceEntity?.id;
	const invoiceId = typeof invoiceIdRaw === "string" && invoiceIdRaw.length > 0 ? invoiceIdRaw : null;
	if (!invoiceId) return null;
	try {
		const inv = await fetchInvoice(invoiceId);
		return typeof inv.short_url === "string" && inv.short_url.length > 0 ? inv.short_url : null;
	} catch (e) {
		logServerError("billing.webhook.fetchInvoice", e);
		return null;
	}
}
/**
 * Subscription state changes that flip plan_code / period bounds and the
 * matching usage_periods row must be atomic. Otherwise a mid-flight failure
 * leaves the subscription on the new period with no quota row (or vice versa)
 * and the student is either over-quota or under-quota.
 *
 * Uses the Drizzle pool (postgres-js direct) instead of supabase-js so we get
 * a real SQL transaction. Side effects (emails, analytics, payment record)
 * stay outside this helper — they are not transactional with the state change.
 *
 * On usage_periods conflict (same subscription_id + period_start), we update
 * the period_end and quota fields but DO NOT reset tests_used / tokens_used.
 * That protects against a delivery replay overwriting in-progress usage; the
 * billing_events dedup at the route layer makes a replay unreachable in
 * normal operation but defense-in-depth is cheap.
 */
async function applySubscriptionStateChangeAtomic(input: {
	subscriptionId: string;
	profileId: string;
	status: string;
	planCode: string;
	currentPeriodStart: Date;
	currentPeriodEnd: Date;
	testsQuota: number;
	tokensQuota: number;
}): Promise<void> {
	await db.transaction(async (tx) => {
		// W1.2: lock the subscription row before reading or mutating state so
		// two webhooks for the same razorpay_subscription_id (e.g., activated +
		// charged firing within milliseconds) serialize cleanly. Without the
		// lock the second writer overwrites the first with no conflict signal,
		// and divergent period bounds between events silently lose data.
		const locked = await tx
			.select({ id: subscriptionsTbl.id, status: subscriptionsTbl.status })
			.from(subscriptionsTbl)
			.where(eq(subscriptionsTbl.id, input.subscriptionId))
			.for("update")
			.limit(1);
		const current = locked[0];
		if (!current) {
			throw new Error(`Subscription ${input.subscriptionId} not found during atomic state change.`);
		}

		// Throws InvalidStateTransitionError on forbidden moves (e.g., a stale
		// subscription.activated event arriving for a sub already cancelled).
		// The route catches that specifically and treats it as a soft-failure
		// (200 + audit) so Razorpay doesn't retry the unrecoverable case.
		assertTransition(current.status, input.status, input.subscriptionId);

		await tx
			.update(subscriptionsTbl)
			.set({
				status: input.status,
				planCode: input.planCode,
				pendingPlanCode: null,
				currentPeriodStart: input.currentPeriodStart,
				currentPeriodEnd: input.currentPeriodEnd,
				updatedAt: new Date(),
				// H3c: recovery to active clears the dunning clock so a future
				// dunning episode re-anchors from its own entry.
				...(input.status === "active" ? { dunningStartedAt: null } : {}),
			})
			.where(eq(subscriptionsTbl.id, input.subscriptionId));

		await tx
			.insert(usagePeriodsTbl)
			.values({
				subscriptionId: input.subscriptionId,
				profileId: input.profileId,
				periodStart: input.currentPeriodStart,
				periodEnd: input.currentPeriodEnd,
				testsQuota: input.testsQuota,
				testsUsed: 0,
				tokensQuota: input.tokensQuota,
				tokensUsed: 0,
			})
			.onConflictDoUpdate({
				target: [usagePeriodsTbl.subscriptionId, usagePeriodsTbl.periodStart],
				set: {
					periodEnd: input.currentPeriodEnd,
					testsQuota: input.testsQuota,
					tokensQuota: input.tokensQuota,
				},
			});
	});
}

/**
 * Mandate / auth step succeeded at Razorpay. Do not flip `plan_code` or paid quotas here —
 * wait for `subscription.activated` or `subscription.charged` so we never grant Pro before payment clears.
 */
async function handleSubscriptionMandateAuthenticated(ctx: WebhookHandlerContext): Promise<void> {
	const { admin, subscriptionId, ours } = ctx;
	await admin.from("practice_analytics_events").insert({
		student_id: ours.profile_id,
		event_name: "subscription_mandate_authenticated",
		props: { razorpay_subscription_id: subscriptionId },
	});
}

async function handleSubscriptionActivated(ctx: WebhookHandlerContext): Promise<void> {
	const { admin, subscriptionId, ours, profile, studentEmail, targetPlan, targetPlanCode, currentStart, currentEnd } = ctx;
	const fallbackEnd = new Date(Date.now() + 31 * 86_400_000).toISOString();
	// M10: guarantee end > start so a payload missing current_end can't write a
	// zero-length (immediately-expired) period for a student who just paid.
	const { startIso: periodStartIso, endIso: periodEndIso } = ensureForwardPeriod(
		currentStart ?? new Date().toISOString(),
		currentEnd ?? ours.current_period_end ?? fallbackEnd,
		targetPlan.interval,
	);

	await applySubscriptionStateChangeAtomic({
		subscriptionId: ours.id,
		profileId: ours.profile_id,
		status: "active",
		planCode: targetPlanCode,
		currentPeriodStart: new Date(periodStartIso),
		currentPeriodEnd: new Date(periodEndIso),
		testsQuota: targetPlan.testsPerPeriod,
		tokensQuota: tokenQuotaForGrade(targetPlan, profile?.grade ?? null),
	});

	// Side effects — not transactional with the state change above.
	await admin.from("practice_analytics_events").insert({
		student_id: ours.profile_id,
		event_name: "subscription_started",
		props: { plan_code: targetPlanCode, razorpay_subscription_id: subscriptionId },
	});
	if (studentEmail && (await isBillingEmailAllowedFor(ours.profile_id))) {
		void sendSubscriptionActiveEmail({
			to: studentEmail,
			recipientUserId: ours.profile_id,
			studentName: profile?.full_name ?? undefined,
			planName: targetPlan.name,
			nextRenewalIso: periodEndIso,
			// Replaying the activation event must not re-send the welcome email.
			dedupKey: `subscription-active:${subscriptionId}:${periodStartIso}`,
		});
	}

	await maybeApplyCheckoutCouponRedemption(admin, {
		profileId: ours.profile_id,
		ourSubscriptionId: ours.id,
		notesUnknown: ctx.subEntity?.notes,
		razorpayEventId: ctx.razorpayEventId,
	});
}

async function handleSubscriptionCharged(ctx: WebhookHandlerContext): Promise<void> {
	const { admin, ours, profile, studentEmail, targetPlan, targetPlanCode, currentStart, currentEnd, paymentEntity } =
		ctx;
	const amt = (paymentEntity?.amount as number | undefined) ?? targetPlan.pricePaise;
	const paymentId = paymentEntity?.id as string | undefined;
	const fallbackIso = new Date().toISOString();
	// M10: guarantee end > start so a payload missing current_end can't write a
	// zero-length (immediately-expired) period.
	const { startIso: periodStartIso, endIso: periodEndIso } = ensureForwardPeriod(
		currentStart ?? ours.current_period_end ?? fallbackIso,
		currentEnd ?? ours.current_period_end ?? fallbackIso,
		targetPlan.interval,
	);

	await applySubscriptionStateChangeAtomic({
		subscriptionId: ours.id,
		profileId: ours.profile_id,
		status: "active",
		planCode: targetPlanCode,
		currentPeriodStart: new Date(periodStartIso),
		currentPeriodEnd: new Date(periodEndIso),
		testsQuota: targetPlan.testsPerPeriod,
		tokensQuota: tokenQuotaForGrade(targetPlan, profile?.grade ?? null),
	});

	if (paymentId) {
		const invoiceShortUrl = await resolveInvoiceShortUrl(paymentEntity, null);
		await admin.from("payments").upsert(
			{
				subscription_id: ours.id,
				profile_id: ours.profile_id,
				razorpay_payment_id: paymentId,
				razorpay_invoice_id: (paymentEntity?.invoice_id as string | undefined) ?? null,
				razorpay_order_id: (paymentEntity?.order_id as string | undefined) ?? null,
				amount_paise: amt,
				currency: (paymentEntity?.currency as string | undefined) ?? "INR",
				status: (paymentEntity?.status as string | undefined) ?? "captured",
				method: (paymentEntity?.method as string | undefined) ?? null,
				captured_at: new Date().toISOString(),
				invoice_short_url: invoiceShortUrl,
				metadata: paymentEntity ?? {},
			},
			{ onConflict: "razorpay_payment_id" },
		);
		const payStatus = String(paymentEntity?.status ?? "captured").toLowerCase();
		if (studentEmail && payStatus !== "failed" && (await isBillingEmailAllowedFor(ours.profile_id))) {
			void sendPaymentReceiptEmail({
				to: studentEmail,
				recipientUserId: ours.profile_id,
				studentName: profile?.full_name ?? undefined,
				amountLabel: formatInrPaise(amt),
				planName: targetPlan.name,
				invoiceShortUrl,
				paymentRef: paymentId,
				// Replaying this billing event must not re-send the receipt.
				dedupKey: `payment-receipt:${paymentId}`,
			});
		}
	}

	await maybeApplyCheckoutCouponRedemption(admin, {
		profileId: ours.profile_id,
		ourSubscriptionId: ours.id,
		notesUnknown: ctx.subEntity?.notes,
		razorpayEventId: ctx.razorpayEventId,
	});
}

async function handleSubscriptionUpdated(ctx: WebhookHandlerContext): Promise<void> {
	// W4.1 — plan change. Razorpay fires subscription.updated when a
	// schedule_change_at="now" plan change goes through (or when cycle_end
	// is reached on a deferred change). The user-facing route stashed
	// pending_plan_code; we use that in preference to whatever notes carry,
	// then apply atomically with new period bounds from the webhook payload.
	const { admin, ours, profile, targetPlan, targetPlanCode, currentStart, currentEnd } = ctx;
	const fallbackIso = new Date().toISOString();
	// M10: guarantee end > start so a payload missing current_end can't write a
	// zero-length (immediately-expired) period.
	const { startIso: periodStartIso, endIso: periodEndIso } = ensureForwardPeriod(
		currentStart ?? ours.current_period_end ?? fallbackIso,
		currentEnd ?? ours.current_period_end ?? fallbackIso,
		targetPlan.interval,
	);

	await applySubscriptionStateChangeAtomic({
		subscriptionId: ours.id,
		profileId: ours.profile_id,
		status: "active",
		planCode: targetPlanCode,
		currentPeriodStart: new Date(periodStartIso),
		currentPeriodEnd: new Date(periodEndIso),
		testsQuota: targetPlan.testsPerPeriod,
		tokensQuota: tokenQuotaForGrade(targetPlan, profile?.grade ?? null),
	});

	await admin.from("practice_analytics_events").insert({
		student_id: ours.profile_id,
		event_name: "subscription_plan_updated",
		props: { plan_code: targetPlanCode, razorpay_subscription_id: ctx.subscriptionId },
	});
}

async function handleSubscriptionCompleted(ctx: WebhookHandlerContext): Promise<void> {
	const { admin, ours } = ctx;
	await admin
		.from("subscriptions")
		.update({ status: "expired", updated_at: new Date().toISOString() })
		.eq("id", ours.id);
}

async function handleSubscriptionCancelled(ctx: WebhookHandlerContext): Promise<void> {
	const { admin, ours } = ctx;
	await admin
		.from("subscriptions")
		.update({
			status: "cancelled",
			cancel_at_period_end: false,
			updated_at: new Date().toISOString(),
		})
		.eq("id", ours.id);
}

async function handleSubscriptionPaused(ctx: WebhookHandlerContext): Promise<void> {
	// Razorpay-confirmed pause. The /api/billing/pause route already mirrored
	// status locally; this handler is the final source of truth and ensures
	// state matches even if the user-route call timed out before its DB write.
	const { admin, ours } = ctx;
	await admin
		.from("subscriptions")
		.update({ status: "paused", paused_at: new Date().toISOString(), updated_at: new Date().toISOString() })
		.eq("id", ours.id)
		.is("paused_at", null);

	// Zero the open period's quota so a pause initiated OUTSIDE our route (the
	// Razorpay dashboard) — or a route call that paused at Razorpay but failed
	// its own DB write — can't leave a paused (non-paying) student with full
	// paid access. Idempotent: only stash + zero when pre_pause_quota hasn't
	// been captured yet, so a webhook retry (or a race with the route) never
	// overwrites the saved originals with the already-zeroed values. Mirrors
	// the /api/billing/pause route logic so route and webhook converge.
	const { data: openPeriod } = await admin
		.from("usage_periods")
		.select("id, tests_quota, tokens_quota, pre_pause_quota")
		.eq("subscription_id", ours.id)
		.order("period_start", { ascending: false })
		.limit(1)
		.maybeSingle<{
			id: string;
			tests_quota: number;
			tokens_quota: number;
			pre_pause_quota: unknown;
		}>();
	if (
		openPeriod &&
		openPeriod.pre_pause_quota == null &&
		(openPeriod.tests_quota > 0 || openPeriod.tokens_quota > 0)
	) {
		await admin
			.from("usage_periods")
			.update({
				pre_pause_quota: { testsQuota: openPeriod.tests_quota, tokensQuota: openPeriod.tokens_quota },
				tests_quota: 0,
				tokens_quota: 0,
			})
			.eq("id", openPeriod.id);
	}
}

async function handleSubscriptionResumed(ctx: WebhookHandlerContext): Promise<void> {
	const { admin, ours } = ctx;
	await admin
		.from("subscriptions")
		.update({ status: "active", paused_at: null, updated_at: new Date().toISOString() })
		.eq("id", ours.id);

	// Restore the quota stashed at pause so a Razorpay-initiated resume doesn't
	// leave a paying student locked out at 0 quota. Idempotent: a no-op once
	// pre_pause_quota is cleared. Mirrors resumeSubscriptionForProfile().
	const { data: openPeriod } = await admin
		.from("usage_periods")
		.select("id, pre_pause_quota")
		.eq("subscription_id", ours.id)
		.order("period_start", { ascending: false })
		.limit(1)
		.maybeSingle<{ id: string; pre_pause_quota: unknown }>();
	// Validate the stashed shape (M8): a drifted / hand-edited JSONB row must not
	// write `undefined` into the integer quota columns — skip the restore instead.
	const restored = parsePrePauseQuota(openPeriod?.pre_pause_quota);
	if (openPeriod && restored) {
		await admin
			.from("usage_periods")
			.update({
				tests_quota: restored.testsQuota,
				tokens_quota: restored.tokensQuota,
				pre_pause_quota: null,
			})
			.eq("id", openPeriod.id);
	}
}

async function handleSubscriptionHaltedOrPending(ctx: WebhookHandlerContext): Promise<void> {
	// Razorpay 'halted' = all auto-retries exhausted; customer must act.
	// Razorpay 'pending' = inside the retry window.
	// We map both to non-terminal local states so a later subscription.charged
	// can recover the sub via the state machine. Previously we mapped halted
	// to 'expired' (terminal), which silently blocked recovery transitions.
	const { admin, eventName, ours } = ctx;
	await admin
		.from("subscriptions")
		.update({
			status: eventName === "subscription.halted" ? "past_due" : "grace",
			updated_at: new Date().toISOString(),
		})
		.eq("id", ours.id);
	// H3c: stamp the dunning clock on first entry only — `.is(null)` ensures a
	// re-fired halted/pending event can't reset it.
	await admin
		.from("subscriptions")
		.update({ dunning_started_at: new Date().toISOString() })
		.eq("id", ours.id)
		.is("dunning_started_at", null);
}

async function handleInvoicePaid(ctx: WebhookHandlerContext): Promise<void> {
	const { admin, invoiceEntity, ours, targetPlan } = ctx;
	if (!invoiceEntity) return;
	const paymentId = typeof invoiceEntity.payment_id === "string" ? invoiceEntity.payment_id : null;
	if (!paymentId) return;

	let shortUrl =
		typeof invoiceEntity.short_url === "string" && invoiceEntity.short_url.length > 0
			? invoiceEntity.short_url
			: null;
	const invoiceId = typeof invoiceEntity.id === "string" ? invoiceEntity.id : null;
	if (!shortUrl && invoiceId) {
		shortUrl = await resolveInvoiceShortUrl(null, invoiceEntity);
	}

	const currency = typeof invoiceEntity.currency === "string" ? invoiceEntity.currency : "INR";

	const { data: existing } = await admin.from("payments").select("id").eq("razorpay_payment_id", paymentId).maybeSingle();

	if (existing) {
		const patch: Record<string, string | null> = {};
		if (shortUrl) patch.invoice_short_url = shortUrl;
		if (invoiceId) patch.razorpay_invoice_id = invoiceId;
		if (Object.keys(patch).length > 0) {
			await admin.from("payments").update(patch).eq("razorpay_payment_id", paymentId);
		}
		return;
	}

	const amountPaise =
		typeof invoiceEntity.amount === "number" && invoiceEntity.amount > 0 ? invoiceEntity.amount : targetPlan.pricePaise;

	await admin.from("payments").insert({
		subscription_id: ours.id,
		profile_id: ours.profile_id,
		razorpay_payment_id: paymentId,
		razorpay_invoice_id: invoiceId,
		amount_paise: amountPaise,
		currency,
		status: "captured",
		method: null,
		captured_at: new Date().toISOString(),
		invoice_short_url: shortUrl,
		metadata: invoiceEntity ?? {},
	});
	// Receipt email is sent from `subscription.charged` to avoid duplicates when both events fire.
}

async function handlePaymentFailed(ctx: WebhookHandlerContext): Promise<void> {
	const { admin, subscriptionId, ours, studentEmail, profile } = ctx;
	await admin
		.from("subscriptions")
		.update({ status: "grace", updated_at: new Date().toISOString() })
		.eq("id", ours.id);
	// H3c: stamp the dunning clock on first entry only (see handleSubscriptionHaltedOrPending).
	await admin
		.from("subscriptions")
		.update({ dunning_started_at: new Date().toISOString() })
		.eq("id", ours.id)
		.is("dunning_started_at", null);
	await admin.from("practice_analytics_events").insert({
		student_id: ours.profile_id,
		event_name: "subscription_payment_failed",
		props: { razorpay_subscription_id: subscriptionId },
	});
	// Payment-failed gates only on the master `enable_email_notifications` switch:
	// a user who explicitly killed all email still doesn't get pinged here, but
	// per-type opt-outs cannot mute this critical signal. (When the
	// `subscription_billing` pref bucket lands, this stays gated on the master
	// switch only.)
	if (studentEmail) {
		const prefs = await getNotificationPrefs(ours.profile_id);
		if (prefs.enableEmail) {
			// W4.3: dedup_key=subscriptionId:dunning-day-0 so the day-0 email
			// is sent at most once per subscription per failure cycle.
			void sendPaymentFailedEmail({
				to: studentEmail,
				recipientUserId: ours.profile_id,
				studentName: profile?.full_name ?? undefined,
				dedupKey: `${ours.id}:dunning-day-0`,
			});
		}
	}
}

const BILLING_WEBHOOK_HANDLERS: Record<string, (c: WebhookHandlerContext) => Promise<void>> = {
	"subscription.authenticated": handleSubscriptionMandateAuthenticated,
	"subscription.activated": handleSubscriptionActivated,
	"subscription.charged": handleSubscriptionCharged,
	"subscription.updated": handleSubscriptionUpdated,
	"subscription.paused": handleSubscriptionPaused,
	"subscription.resumed": handleSubscriptionResumed,
	"subscription.completed": handleSubscriptionCompleted,
	"subscription.cancelled": handleSubscriptionCancelled,
	"subscription.halted": handleSubscriptionHaltedOrPending,
	"subscription.pending": handleSubscriptionHaltedOrPending,
	"payment.failed": handlePaymentFailed,
	"invoice.paid": handleInvoicePaid,
};

/**
 * W3.2 — refund event handler (refund.processed / refund.created / refund.failed).
 *
 * Razorpay does NOT emit a `payment.refunded` event; the canonical refund
 * lifecycle is `refund.created` (initiated) → `refund.processed` (funds
 * actually returned) or `refund.failed`. We act on `refund.processed` to
 * roll back the coupon redemption (decrement count + mark refunded_at);
 * `refund.created` is informational; `refund.failed` is escalated to
 * billing_action_failures so an admin can investigate.
 */
async function handleRefundEvent(
	admin: ServiceRoleClient,
	body: RazorpayWebhookBody,
): Promise<void> {
	const refundEntity = (body.payload?.refund?.entity as Record<string, unknown> | undefined) ?? null;
	if (!refundEntity) return;
	const paymentId = typeof refundEntity.payment_id === "string" ? refundEntity.payment_id : null;
	if (!paymentId) return;
	const refundId = typeof refundEntity.id === "string" ? refundEntity.id : null;
	const refundAmount = typeof refundEntity.amount === "number" ? refundEntity.amount : null;

	const { data: pay } = await admin
		.from("payments")
		.select("id, subscription_id, profile_id, refunded_at, razorpay_refund_id")
		.eq("razorpay_payment_id", paymentId)
		.maybeSingle<{
			id: string;
			subscription_id: string | null;
			profile_id: string;
			refunded_at: string | null;
			razorpay_refund_id: string | null;
		}>();

	if (!pay) {
		Sentry.captureMessage("billing.webhook.refund.payment_not_found", {
			level: "warning",
			tags: { component: "billing.webhook", event: body.event },
			extra: { razorpay_payment_id: paymentId, razorpay_refund_id: refundId },
		});
		return;
	}

	if (body.event === "refund.failed") {
		await admin.from("billing_action_failures").insert({
			kind: "refund_coupon_rollback",
			payment_id: pay.id,
			profile_id: pay.profile_id,
			subscription_id: pay.subscription_id,
			razorpay_event_id: body.id ?? null,
			error_message: `Razorpay refund.failed for refund=${refundId ?? "?"} payment=${paymentId}`,
			payload: { refund_entity: refundEntity },
		});
		Sentry.captureMessage("billing.webhook.refund.failed", {
			level: "error",
			tags: { component: "billing.webhook" },
			extra: { razorpay_payment_id: paymentId, razorpay_refund_id: refundId },
		});
		return;
	}

	if (body.event === "refund.created") {
		// Informational — Razorpay has accepted the refund request but not yet
		// disbursed funds. Audit only; the rollback waits for processed.
		await admin.from("practice_analytics_events").insert({
			student_id: pay.profile_id,
			event_name: "subscription_refund_created",
			props: { razorpay_payment_id: paymentId, razorpay_refund_id: refundId },
		});
		return;
	}

	// refund.processed — flush the local payments row + roll back the coupon.
	if (body.event === "refund.processed") {
		// Update payments row idempotently (if it wasn't already marked refunded
		// by the admin route).
		if (!pay.refunded_at) {
			await admin
				.from("payments")
				.update({
					razorpay_refund_id: refundId,
					refund_amount_paise: refundAmount,
					refunded_at: new Date().toISOString(),
					status: "refunded",
				})
				.eq("id", pay.id);
		}

		// Roll back the coupon redemption if the original payment used one.
		// Idempotent: a duplicate webhook delivery (or admin-route + webhook
		// firing concurrently) finds refunded_at already set and exits cleanly.
		if (pay.subscription_id) {
			const { data, error } = await admin.rpc("billing_rollback_coupon_redemption_atomic", {
				p_subscription_id: pay.subscription_id,
				p_profile_id: pay.profile_id,
			});
			if (error) {
				await admin.from("billing_action_failures").insert({
					kind: "refund_coupon_rollback",
					payment_id: pay.id,
					profile_id: pay.profile_id,
					subscription_id: pay.subscription_id,
					razorpay_event_id: body.id ?? null,
					error_message: `rollback_coupon_redemption_atomic: ${error.message}`,
					payload: { razorpay_payment_id: paymentId, razorpay_refund_id: refundId },
				});
				Sentry.captureMessage("billing.webhook.refund.rollback_failed", {
					level: "error",
					extra: { error: error.message, payment_id: pay.id },
				});
			} else {
				const row = (Array.isArray(data) ? data[0] : data) as
					| { ok?: boolean; rolled_back?: boolean; coupon_id?: string | null }
					| undefined;
				if (row?.rolled_back && row.coupon_id) {
					await admin.from("practice_analytics_events").insert({
						student_id: pay.profile_id,
						event_name: "coupon_redemption_refund_rollback",
						props: { coupon_id: row.coupon_id, razorpay_payment_id: paymentId },
					});
				}
			}
		}
	}
}

export async function processRazorpayWebhookPayload(
	admin: ServiceRoleClient,
	body: RazorpayWebhookBody,
): Promise<void> {
	// Refund events use the refund.entity payload, not subscription.entity.
	// Handle them before the subscription-id derivation so we don't early-
	// return on the !subscriptionId guard below.
	if (body.event === "refund.processed" || body.event === "refund.created" || body.event === "refund.failed") {
		await handleRefundEvent(admin, body);
		return;
	}

	const subEntity = (body.payload?.subscription?.entity as Record<string, unknown> | undefined) ?? null;
	const paymentEntity = (body.payload?.payment?.entity as Record<string, unknown> | undefined) ?? null;
	const invoiceEntity = (body.payload?.invoice?.entity as Record<string, unknown> | undefined) ?? null;
	const subscriptionId =
		(subEntity?.id as string | undefined) ??
		(paymentEntity?.subscription_id as string | undefined) ??
		(invoiceEntity?.subscription_id as string | undefined) ??
		null;

	if (!subscriptionId) return;

	const { data: ours } = await admin
		.from("subscriptions")
		.select("id, profile_id, plan_code, pending_plan_code, current_period_end")
		.eq("razorpay_subscription_id", subscriptionId)
		.maybeSingle<SubscriptionOurs>();
	if (!ours) {
		Sentry.captureMessage(`Webhook for unknown subscription ${subscriptionId}`);
		return;
	}

	const [{ data: profile }, authUserResult] = await Promise.all([
		admin.from("profiles").select("id, grade, full_name").eq("id", ours.profile_id).maybeSingle<ProfileRow>(),
		admin.auth.admin.getUserById(ours.profile_id),
	]);
	const studentEmail = authUserResult.data.user?.email ?? null;

	const notesPlan = (subEntity?.notes as { plan_code?: string } | undefined)?.plan_code;
	const targetPlanCode: PlanCode = isPlanCode(ours.pending_plan_code)
		? ours.pending_plan_code
		: isPlanCode(notesPlan)
			? notesPlan
			: isPlanCode(ours.plan_code)
				? ours.plan_code
				: "pro_monthly";
	const targetPlan = PLAN_CATALOG[targetPlanCode];

	const currentStart = iso(subEntity?.current_start as number | undefined);
	const currentEnd = iso(subEntity?.current_end as number | undefined);

	const ctx: WebhookHandlerContext = {
		admin,
		eventName: body.event,
		razorpayEventId: typeof body.id === "string" && body.id.length > 0 ? body.id : null,
		subscriptionId,
		ours,
		profile: profile ?? null,
		studentEmail,
		subEntity,
		paymentEntity,
		invoiceEntity,
		targetPlanCode,
		targetPlan,
		currentStart,
		currentEnd,
	};

	const handler = BILLING_WEBHOOK_HANDLERS[body.event];
	if (handler) {
		await handler(ctx);
	} else {
		Sentry.captureMessage(`Unhandled Razorpay webhook event: ${body.event}`, {
			level: "info",
			tags: { component: "billing.webhook", event: body.event },
		});
	}
}
