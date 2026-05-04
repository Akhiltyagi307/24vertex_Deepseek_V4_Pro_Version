import "server-only";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { subscriptions as subscriptionsTbl, usagePeriods as usagePeriodsTbl } from "@/db/schema/billing";
import { fetchInvoice } from "@/lib/billing/razorpay";
import { isPlanCode, PLAN_CATALOG, tokenQuotaForGrade, type PlanCode, type PlanCatalogEntry } from "@/lib/billing/plans";
import {
	sendPaymentFailedEmail,
	sendPaymentReceiptEmail,
	sendSubscriptionActiveEmail,
} from "@/lib/email/subscription-notifications";
import { getNotificationPrefs, isEmailAllowed } from "@/lib/notifications/prefs";
import { logServerError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

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
	admin: ReturnType<typeof createServiceRoleClient>;
	eventName: string;
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

/** Records checkout_discount redemption once (idempotent) when notes carry `eduai_coupon_id`. */
async function maybeApplyCheckoutCouponRedemption(
	admin: ReturnType<typeof createServiceRoleClient>,
	input: { profileId: string; ourSubscriptionId: string; notesUnknown: unknown },
): Promise<void> {
	const notes = input.notesUnknown as Record<string, unknown> | undefined;
	const raw = notes?.eduai_coupon_id ?? notes?.eduai_coupon;
	const couponId = typeof raw === "string" && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
	if (!couponId) return;

	const { data, error } = await admin.rpc("billing_apply_checkout_coupon_redemption_atomic", {
		p_coupon_id: couponId,
		p_profile_id: input.profileId,
		p_our_subscription_id: input.ourSubscriptionId,
	});

	if (error) {
		Sentry.captureMessage(`billing_apply_checkout_coupon_redemption_atomic: ${error.message}`, { level: "warning" });
		return;
	}
	const row = (Array.isArray(data) ? data[0] : data) as { ok?: boolean; applied?: boolean } | undefined;
	if (row?.ok && row.applied) {
		await admin.from("practice_analytics_events").insert({
			student_id: input.profileId,
			event_name: "coupon_redeemed",
			props: { checkout_discount: true, coupon_id: couponId },
		});
	}
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
		await tx
			.update(subscriptionsTbl)
			.set({
				status: input.status,
				planCode: input.planCode,
				pendingPlanCode: null,
				currentPeriodStart: input.currentPeriodStart,
				currentPeriodEnd: input.currentPeriodEnd,
				updatedAt: new Date(),
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
	const periodStartIso = currentStart ?? new Date().toISOString();
	const periodEndIso = currentEnd ?? ours.current_period_end ?? fallbackEnd;

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
		});
	}

	await maybeApplyCheckoutCouponRedemption(admin, {
		profileId: ours.profile_id,
		ourSubscriptionId: ours.id,
		notesUnknown: ctx.subEntity?.notes,
	});
}

async function handleSubscriptionCharged(ctx: WebhookHandlerContext): Promise<void> {
	const { admin, ours, profile, studentEmail, targetPlan, targetPlanCode, currentStart, currentEnd, paymentEntity } =
		ctx;
	const amt = (paymentEntity?.amount as number | undefined) ?? targetPlan.pricePaise;
	const paymentId = paymentEntity?.id as string | undefined;
	const fallbackIso = new Date().toISOString();
	const periodStartIso = currentStart ?? ours.current_period_end ?? fallbackIso;
	const periodEndIso = currentEnd ?? ours.current_period_end ?? fallbackIso;

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
			});
		}
	}

	await maybeApplyCheckoutCouponRedemption(admin, {
		profileId: ours.profile_id,
		ourSubscriptionId: ours.id,
		notesUnknown: ctx.subEntity?.notes,
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

async function handleSubscriptionHaltedOrPending(ctx: WebhookHandlerContext): Promise<void> {
	const { admin, eventName, ours } = ctx;
	await admin
		.from("subscriptions")
		.update({
			status: eventName === "subscription.halted" ? "expired" : "grace",
			updated_at: new Date().toISOString(),
		})
		.eq("id", ours.id);
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
			void sendPaymentFailedEmail({
				to: studentEmail,
				recipientUserId: ours.profile_id,
				studentName: profile?.full_name ?? undefined,
			});
		}
	}
}

const BILLING_WEBHOOK_HANDLERS: Record<string, (c: WebhookHandlerContext) => Promise<void>> = {
	"subscription.authenticated": handleSubscriptionMandateAuthenticated,
	"subscription.activated": handleSubscriptionActivated,
	"subscription.charged": handleSubscriptionCharged,
	"subscription.completed": handleSubscriptionCompleted,
	"subscription.cancelled": handleSubscriptionCancelled,
	"subscription.halted": handleSubscriptionHaltedOrPending,
	"subscription.pending": handleSubscriptionHaltedOrPending,
	"payment.failed": handlePaymentFailed,
	"invoice.paid": handleInvoicePaid,
};

export async function processRazorpayWebhookPayload(
	admin: ReturnType<typeof createServiceRoleClient>,
	body: RazorpayWebhookBody,
): Promise<void> {
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
