import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { isPlanCode, PLAN_CATALOG, tokenQuotaForGrade, type PlanCode, type PlanCatalogEntry } from "@/lib/billing/plans";
import {
	sendPaymentFailedEmail,
	sendSubscriptionActiveEmail,
} from "@/lib/email/subscription-notifications";
import { logServerError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebhookEvent = {
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
	targetPlanCode: PlanCode;
	targetPlan: PlanCatalogEntry;
	currentStart: string | null;
	currentEnd: string | null;
};

function iso(epochSec: number | null | undefined): string | null {
	if (!epochSec || Number.isNaN(epochSec)) return null;
	return new Date(epochSec * 1000).toISOString();
}

/**
 * Razorpay Subscriptions + payments webhook.
 *
 * Events handled (map to subscription state machine):
 *   subscription.authenticated  → mandate created, becomes `active`
 *   subscription.activated      → first successful charge
 *   subscription.charged        → roll usage_periods, append payment
 *   subscription.completed      → total_count reached
 *   subscription.cancelled      → status=cancelled
 *   subscription.halted         → too many retries, status=expired
 *   subscription.pending        → payment authorization failed, status=grace
 *   payment.failed              → status=grace (first strike)
 *   invoice.paid                → backstop payment log
 */
export async function POST(req: Request) {
	const raw = await req.text();
	const signature = req.headers.get("x-razorpay-signature");
	if (!verifyWebhookSignature(raw, signature)) {
		return Response.json({ ok: false, message: "Bad signature." }, { status: 401 });
	}

	let body: WebhookEvent;
	try {
		body = JSON.parse(raw) as WebhookEvent;
	} catch {
		return Response.json({ ok: false, message: "Invalid JSON." }, { status: 400 });
	}

	const admin = createServiceRoleClient();
	// Razorpay does not emit an event id; synthesize one for idempotency.
	const eventId = `${body.event}:${(body.payload?.payment?.entity as { id?: string } | undefined)?.id ?? (body.payload?.subscription?.entity as { id?: string } | undefined)?.id ?? ""}:${(body.payload?.subscription?.entity as { current_start?: number } | undefined)?.current_start ?? Math.floor(Date.now() / 1000)}`;

	const { data: existing } = await admin
		.from("billing_events")
		.select("id")
		.eq("razorpay_event_id", eventId)
		.maybeSingle();

	if (existing) {
		// Already processed — idempotent ack.
		return Response.json({ ok: true, deduped: true });
	}

	await admin.from("billing_events").insert({
		razorpay_event_id: eventId,
		event_type: body.event,
		payload: body,
	});

	try {
		await handleEvent(admin, body);
		revalidatePath("/student", "layout");
		await admin
			.from("billing_events")
			.update({ processed_at: new Date().toISOString() })
			.eq("razorpay_event_id", eventId);
	} catch (err) {
		Sentry.captureException(err, { tags: { component: "billing.webhook", event: body.event } });
		logServerError("billing.webhook.handle", err);
		await admin
			.from("billing_events")
			.update({ error: err instanceof Error ? err.message : String(err) })
			.eq("razorpay_event_id", eventId);
		return Response.json({ ok: false }, { status: 500 });
	}

	return Response.json({ ok: true });
}

async function upsertUsagePeriod(
	admin: ReturnType<typeof createServiceRoleClient>,
	input: {
		subscriptionId: string;
		profileId: string;
		periodStart: string;
		periodEnd: string;
		testsQuota: number;
		tokensQuota: number;
	},
): Promise<void> {
	await admin.from("usage_periods").upsert(
		{
			subscription_id: input.subscriptionId,
			profile_id: input.profileId,
			period_start: input.periodStart,
			period_end: input.periodEnd,
			tests_quota: input.testsQuota,
			tests_used: 0,
			tokens_quota: input.tokensQuota,
			tokens_used: 0,
		},
		{ onConflict: "subscription_id,period_start" },
	);
}

async function handleSubscriptionAuthenticated(
	ctx: WebhookHandlerContext,
): Promise<void> {
	const { admin, eventName, subscriptionId, ours, profile, studentEmail, targetPlan, targetPlanCode, currentStart, currentEnd } =
		ctx;
	await admin
		.from("subscriptions")
		.update({
			status: "active",
			plan_code: targetPlanCode,
			pending_plan_code: null,
			current_period_start: currentStart ?? new Date().toISOString(),
			current_period_end: currentEnd ?? (ours.current_period_end ?? new Date(Date.now() + 31 * 86_400_000).toISOString()),
			updated_at: new Date().toISOString(),
		})
		.eq("id", ours.id);
	await upsertUsagePeriod(admin, {
		subscriptionId: ours.id,
		profileId: ours.profile_id,
		periodStart: currentStart ?? new Date().toISOString(),
		periodEnd: currentEnd ?? new Date(Date.now() + 31 * 86_400_000).toISOString(),
		testsQuota: targetPlan.testsPerPeriod,
		tokensQuota: tokenQuotaForGrade(targetPlan, profile?.grade ?? null),
	});
	await admin.from("practice_analytics_events").insert({
		student_id: ours.profile_id,
		event_name: "subscription_started",
		props: { plan_code: targetPlanCode, razorpay_subscription_id: subscriptionId },
	});
	if (eventName === "subscription.activated" && studentEmail) {
		void sendSubscriptionActiveEmail({
			to: studentEmail,
			studentName: profile?.full_name ?? undefined,
			planName: targetPlan.name,
			nextRenewalIso: currentEnd ?? new Date(Date.now() + 31 * 86_400_000).toISOString(),
		});
	}
}

async function handleSubscriptionCharged(ctx: WebhookHandlerContext): Promise<void> {
	const { admin, subscriptionId, ours, profile, targetPlan, targetPlanCode, currentStart, currentEnd, paymentEntity } = ctx;
	const amt = (paymentEntity?.amount as number | undefined) ?? targetPlan.pricePaise;
	const paymentId = paymentEntity?.id as string | undefined;
	const periodStart = currentStart ?? ours.current_period_end;
	const periodEnd = currentEnd ?? ours.current_period_end;
	await admin
		.from("subscriptions")
		.update({
			status: "active",
			plan_code: targetPlanCode,
			pending_plan_code: null,
			current_period_start: periodStart,
			current_period_end: periodEnd,
			updated_at: new Date().toISOString(),
		})
		.eq("id", ours.id);
	await upsertUsagePeriod(admin, {
		subscriptionId: ours.id,
		profileId: ours.profile_id,
		periodStart: periodStart ?? new Date().toISOString(),
		periodEnd: periodEnd ?? new Date().toISOString(),
		testsQuota: targetPlan.testsPerPeriod,
		tokensQuota: tokenQuotaForGrade(targetPlan, profile?.grade ?? null),
	});
	if (paymentId) {
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
				metadata: paymentEntity ?? {},
			},
			{ onConflict: "razorpay_payment_id" },
		);
	}
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
	if (studentEmail) {
		void sendPaymentFailedEmail({ to: studentEmail, studentName: profile?.full_name ?? undefined });
	}
}

const BILLING_WEBHOOK_HANDLERS: Record<string, (c: WebhookHandlerContext) => Promise<void>> = {
	"subscription.authenticated": handleSubscriptionAuthenticated,
	"subscription.activated": handleSubscriptionAuthenticated,
	"subscription.charged": handleSubscriptionCharged,
	"subscription.completed": handleSubscriptionCompleted,
	"subscription.cancelled": handleSubscriptionCancelled,
	"subscription.halted": handleSubscriptionHaltedOrPending,
	"subscription.pending": handleSubscriptionHaltedOrPending,
	"payment.failed": handlePaymentFailed,
	"invoice.paid": async () => {
		// Handled alongside subscription.charged; no-op backstop.
	},
};

async function handleEvent(
	admin: ReturnType<typeof createServiceRoleClient>,
	body: WebhookEvent,
): Promise<void> {
	const subEntity = (body.payload?.subscription?.entity as Record<string, unknown> | undefined) ?? null;
	const paymentEntity = (body.payload?.payment?.entity as Record<string, unknown> | undefined) ?? null;
	const subscriptionId =
		(subEntity?.id as string | undefined) ??
		(paymentEntity?.subscription_id as string | undefined) ??
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
		targetPlanCode,
		targetPlan,
		currentStart,
		currentEnd,
	};

	const handler = BILLING_WEBHOOK_HANDLERS[body.event];
	if (handler) {
		await handler(ctx);
	}
}
