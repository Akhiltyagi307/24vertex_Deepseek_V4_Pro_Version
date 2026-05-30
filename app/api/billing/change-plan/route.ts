import { z } from "zod";

import { getApiRequestUser } from "@/lib/auth/api-request-user";
import { isPlanCode, PAID_CHECKOUT_PLAN_CODES, type PlanCode } from "@/lib/billing/plans";
import { defaultWhenForChange, quotePlanChange } from "@/lib/billing/proration";
import { updateSubscriptionPlan } from "@/lib/billing/razorpay";
import { canTransition, isSubscriptionStatus } from "@/lib/billing/subscription-state-machine";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { rlConsume } from "@/lib/ratelimit/consume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
	newPlanCode: z.enum(["pro_monthly", "pro_annual"]),
	when: z.enum(["now", "cycle_end"]).optional(),
});

const RATE_LIMIT_PER_MIN = 5;
const RATE_WINDOW_SEC = 60;

/**
 * W4.1 — user-facing plan change.
 *
 * Flow:
 *   1. Authenticate, validate body, rate-limit (plan-changes are rare; tight
 *      cap protects against UI bugs causing churn-storms).
 *   2. Quote local proration delta (audit-only — Razorpay doesn't auto-charge).
 *   3. Insert pending billing_plan_changes row.
 *   4. Call Razorpay subscriptions.update with schedule_change_at.
 *   5. Mark row completed; the subscription.updated webhook flips plan_code.
 */
export async function POST(req: Request) {
	const auth = await getApiRequestUser(req);
	if (!auth) {
		return Response.json({ success: false, ok: false, message: "Unauthorized." }, { status: 401 });
	}
	const { user, supabase } = auth;
	void supabase;

	const json = await req.json().catch(() => null);
	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) {
		return Response.json({ success: false, ok: false, message: "Invalid request." }, { status: 400 });
	}

	const rl = await rlConsume({
		key: `change-plan:user:${user.id}`,
		limit: RATE_LIMIT_PER_MIN,
		windowSec: RATE_WINDOW_SEC,
	});
	if (!rl.allowed) {
		const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000));
		return Response.json(
			{ success: false, ok: false, code: "rate_limited", message: "Too many plan-change attempts. Slow down." },
			{ status: 429, headers: { "Retry-After": String(retryAfterSec) } },
		);
	}

	const admin = createServiceRoleClient();
	const { data: subRow, error: subErr } = await admin
		.from("subscriptions")
		.select("id, profile_id, plan_code, status, current_period_start, current_period_end, razorpay_subscription_id")
		.eq("profile_id", user.id)
		.maybeSingle<{
			id: string;
			profile_id: string;
			plan_code: string;
			status: string;
			current_period_start: string;
			current_period_end: string;
			razorpay_subscription_id: string | null;
		}>();
	if (subErr) {
		logSupabaseError("billing.change-plan.sub", subErr, { profileId: user.id });
		return Response.json({ success: false, ok: false, message: "Subscription lookup failed." }, { status: 500 });
	}
	if (!subRow) {
		return Response.json({ success: false, ok: false, message: "No subscription found." }, { status: 404 });
	}
	if (!subRow.razorpay_subscription_id) {
		return Response.json(
			{ success: false, ok: false, message: "Subscription is not linked to Razorpay; can't change plan." },
			{ status: 409 },
		);
	}

	if (!isPlanCode(subRow.plan_code) || !PAID_CHECKOUT_PLAN_CODES.includes(subRow.plan_code as PlanCode)) {
		return Response.json(
			{ success: false, ok: false, message: "Plan changes are only supported between paid plans (pro_monthly ↔ pro_annual)." },
			{ status: 409 },
		);
	}

	if (subRow.plan_code === parsed.data.newPlanCode) {
		return Response.json({ success: false, ok: false, message: "Already on this plan." }, { status: 409 });
	}

	// State-machine: only allow plan change while active. Past_due / cancelled
	// flows should resolve through dunning or re-checkout, not plan change.
	if (!isSubscriptionStatus(subRow.status) || !canTransition(subRow.status, "active") || subRow.status !== "active") {
		return Response.json(
			{
				success: false, ok: false,
				code: "wrong_status",
				message: `Plan changes require an active subscription (current: ${subRow.status}).`,
			},
			{ status: 409 },
		);
	}

	const { data: newPlan, error: newPlanErr } = await admin
		.from("plans")
		.select("razorpay_plan_id")
		.eq("code", parsed.data.newPlanCode)
		.maybeSingle();
	if (newPlanErr || !newPlan?.razorpay_plan_id) {
		if (newPlanErr) logSupabaseError("billing.change-plan.plan", newPlanErr);
		return Response.json({ success: false, ok: false, message: "Target plan is not seeded in Razorpay." }, { status: 503 });
	}

	const when = parsed.data.when ?? defaultWhenForChange(subRow.plan_code as PlanCode, parsed.data.newPlanCode);
	const quote = quotePlanChange({
		fromPlanCode: subRow.plan_code as PlanCode,
		toPlanCode: parsed.data.newPlanCode,
		currentPeriodStart: new Date(subRow.current_period_start),
		currentPeriodEnd: new Date(subRow.current_period_end),
	});

	// Insert pending plan-change row before the Razorpay call so a crash
	// after the call leaves an audit trail.
	const { data: planChangeRow, error: insertErr } = await admin
		.from("billing_plan_changes")
		.insert({
			subscription_id: subRow.id,
			from_plan_code: subRow.plan_code,
			to_plan_code: parsed.data.newPlanCode,
			when_applied: when,
			proration_delta_paise: quote.deltaPaise,
			initiated_by_user_id: user.id,
		})
		.select("id")
		.single<{ id: string }>();
	if (insertErr || !planChangeRow) {
		logSupabaseError("billing.change-plan.insert_audit", insertErr, { subId: subRow.id });
		return Response.json({ success: false, ok: false, message: "Could not record plan change." }, { status: 500 });
	}

	try {
		await updateSubscriptionPlan(subRow.razorpay_subscription_id, newPlan.razorpay_plan_id, {
			scheduleChangeAt: when,
			customerNotify: 1,
		});
	} catch (e) {
		logServerError("billing.change-plan.razorpay_update", e);
		await admin
			.from("billing_plan_changes")
			.update({ error_message: e instanceof Error ? e.message : String(e) })
			.eq("id", planChangeRow.id);
		return Response.json(
			{ success: false, ok: false, message: "Razorpay rejected the plan change.", code: "razorpay_error" },
			{ status: 502 },
		);
	}

	// Stash pending_plan_code so the subscription.updated webhook knows what
	// plan_code to flip to when it fires.
	await admin
		.from("subscriptions")
		.update({ pending_plan_code: parsed.data.newPlanCode, updated_at: new Date().toISOString() })
		.eq("id", subRow.id);

	await admin
		.from("billing_plan_changes")
		.update({ completed_at: new Date().toISOString() })
		.eq("id", planChangeRow.id);

	return Response.json({
		ok: true,
		when,
		from_plan: subRow.plan_code,
		to_plan: parsed.data.newPlanCode,
		proration: {
			delta_paise: quote.deltaPaise,
			is_upgrade: quote.isUpgrade,
			period_remaining_sec: quote.periodRemainingSec,
		},
	});
}
