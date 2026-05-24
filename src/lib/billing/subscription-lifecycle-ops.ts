import "server-only";

import { isPlanCode, PAID_CHECKOUT_PLAN_CODES, type PlanCode } from "@/lib/billing/plans";
import { defaultWhenForChange, quotePlanChange } from "@/lib/billing/proration";
import { pauseSubscription, resumeSubscription, updateSubscriptionPlan } from "@/lib/billing/razorpay";
import { canTransition, isSubscriptionStatus } from "@/lib/billing/subscription-state-machine";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type SubscriptionLifecycleResult =
	| { ok: true; deduped?: boolean; when?: string; from_plan?: string; to_plan?: string }
	| { ok: false; status: number; code?: string; message: string };

export async function changeSubscriptionPlanForProfile(input: {
	profileId: string;
	newPlanCode: PlanCode;
	when?: "now" | "cycle_end";
	initiatedByUserId?: string | null;
}): Promise<SubscriptionLifecycleResult> {
	const admin = createServiceRoleClient();
	const { data: subRow, error: subErr } = await admin
		.from("subscriptions")
		.select("id, profile_id, plan_code, status, current_period_start, current_period_end, razorpay_subscription_id")
		.eq("profile_id", input.profileId)
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
		logSupabaseError("billing.change-plan.sub", subErr, { profileId: input.profileId });
		return { ok: false, status: 500, message: "Subscription lookup failed." };
	}
	if (!subRow) return { ok: false, status: 404, message: "No subscription found." };
	if (!subRow.razorpay_subscription_id) {
		return { ok: false, status: 409, message: "Subscription is not linked to Razorpay; can't change plan." };
	}
	if (!isPlanCode(subRow.plan_code) || !PAID_CHECKOUT_PLAN_CODES.includes(subRow.plan_code as PlanCode)) {
		return {
			ok: false,
			status: 409,
			message: "Plan changes are only supported between paid plans (pro_monthly ↔ pro_annual).",
		};
	}
	if (subRow.plan_code === input.newPlanCode) {
		return { ok: false, status: 409, message: "Already on this plan." };
	}
	if (!isSubscriptionStatus(subRow.status) || !canTransition(subRow.status, "active") || subRow.status !== "active") {
		return {
			ok: false,
			status: 409,
			code: "wrong_status",
			message: `Plan changes require an active subscription (current: ${subRow.status}).`,
		};
	}

	const { data: newPlan, error: newPlanErr } = await admin
		.from("plans")
		.select("razorpay_plan_id")
		.eq("code", input.newPlanCode)
		.maybeSingle();
	if (newPlanErr || !newPlan?.razorpay_plan_id) {
		if (newPlanErr) logSupabaseError("billing.change-plan.plan", newPlanErr);
		return { ok: false, status: 503, message: "Target plan is not seeded in Razorpay." };
	}

	const when =
		input.when ?? defaultWhenForChange(subRow.plan_code as PlanCode, input.newPlanCode);
	const quote = quotePlanChange({
		fromPlanCode: subRow.plan_code as PlanCode,
		toPlanCode: input.newPlanCode,
		currentPeriodStart: new Date(subRow.current_period_start),
		currentPeriodEnd: new Date(subRow.current_period_end),
	});

	const { data: planChangeRow, error: insertErr } = await admin
		.from("billing_plan_changes")
		.insert({
			subscription_id: subRow.id,
			from_plan_code: subRow.plan_code,
			to_plan_code: input.newPlanCode,
			when_applied: when,
			proration_delta_paise: quote.deltaPaise,
			initiated_by_user_id: input.initiatedByUserId ?? null,
		})
		.select("id")
		.single<{ id: string }>();
	if (insertErr || !planChangeRow) {
		logSupabaseError("billing.change-plan.insert_audit", insertErr, { subId: subRow.id });
		return { ok: false, status: 500, message: "Could not record plan change." };
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
		return { ok: false, status: 502, code: "razorpay_error", message: "Razorpay rejected the plan change." };
	}

	await admin
		.from("subscriptions")
		.update({ pending_plan_code: input.newPlanCode, updated_at: new Date().toISOString() })
		.eq("id", subRow.id);

	await admin
		.from("billing_plan_changes")
		.update({ completed_at: new Date().toISOString() })
		.eq("id", planChangeRow.id);

	return {
		ok: true,
		when,
		from_plan: subRow.plan_code,
		to_plan: input.newPlanCode,
	};
}

export async function pauseSubscriptionForProfile(profileId: string): Promise<SubscriptionLifecycleResult> {
	const admin = createServiceRoleClient();
	const { data: sub, error: subErr } = await admin
		.from("subscriptions")
		.select("id, status, razorpay_subscription_id")
		.eq("profile_id", profileId)
		.maybeSingle<{ id: string; status: string; razorpay_subscription_id: string | null }>();
	if (subErr || !sub) {
		if (subErr) logSupabaseError("billing.pause.sub", subErr);
		return { ok: false, status: 404, message: "Subscription not found." };
	}
	if (!sub.razorpay_subscription_id) {
		return { ok: false, status: 409, message: "Subscription not linked to Razorpay." };
	}
	if (sub.status === "paused") return { ok: true, deduped: true };
	if (sub.status !== "active") {
		return {
			ok: false,
			status: 409,
			code: "wrong_status",
			message: `Pause requires active status (got ${sub.status}).`,
		};
	}

	try {
		await pauseSubscription(sub.razorpay_subscription_id, { pauseAt: "now" });
	} catch (e) {
		logServerError("billing.pause.razorpay", e);
		return { ok: false, status: 502, message: "Razorpay rejected the pause." };
	}

	const now = new Date().toISOString();
	await admin.from("subscriptions").update({ status: "paused", paused_at: now, updated_at: now }).eq("id", sub.id);

	const { data: openPeriod } = await admin
		.from("usage_periods")
		.select("id, tests_quota, tokens_quota")
		.eq("subscription_id", sub.id)
		.order("period_start", { ascending: false })
		.limit(1)
		.maybeSingle<{ id: string; tests_quota: number; tokens_quota: number }>();

	if (openPeriod) {
		await admin
			.from("usage_periods")
			.update({
				pre_pause_quota: { testsQuota: openPeriod.tests_quota, tokensQuota: openPeriod.tokens_quota },
				tests_quota: 0,
				tokens_quota: 0,
			})
			.eq("id", openPeriod.id);
	}

	await admin.from("practice_analytics_events").insert({
		student_id: profileId,
		event_name: "subscription_paused",
		props: { subscription_id: sub.id, admin_initiated: true },
	});

	return { ok: true };
}

export async function resumeSubscriptionForProfile(profileId: string): Promise<SubscriptionLifecycleResult> {
	const admin = createServiceRoleClient();
	const { data: sub, error: subErr } = await admin
		.from("subscriptions")
		.select("id, status, razorpay_subscription_id")
		.eq("profile_id", profileId)
		.maybeSingle<{ id: string; status: string; razorpay_subscription_id: string | null }>();
	if (subErr || !sub) {
		if (subErr) logSupabaseError("billing.resume.sub", subErr);
		return { ok: false, status: 404, message: "Subscription not found." };
	}
	if (!sub.razorpay_subscription_id) {
		return { ok: false, status: 409, message: "Subscription not linked to Razorpay." };
	}
	if (sub.status === "active") return { ok: true, deduped: true };
	if (sub.status !== "paused") {
		return {
			ok: false,
			status: 409,
			code: "wrong_status",
			message: `Resume requires paused status (got ${sub.status}).`,
		};
	}

	try {
		await resumeSubscription(sub.razorpay_subscription_id, { resumeAt: "now" });
	} catch (e) {
		logServerError("billing.resume.razorpay", e);
		return { ok: false, status: 502, message: "Razorpay rejected the resume." };
	}

	const now = new Date().toISOString();
	await admin.from("subscriptions").update({ status: "active", paused_at: null, updated_at: now }).eq("id", sub.id);

	const { data: openPeriod } = await admin
		.from("usage_periods")
		.select("id, pre_pause_quota")
		.eq("subscription_id", sub.id)
		.order("period_start", { ascending: false })
		.limit(1)
		.maybeSingle<{ id: string; pre_pause_quota: { testsQuota: number; tokensQuota: number } | null }>();

	if (openPeriod?.pre_pause_quota) {
		await admin
			.from("usage_periods")
			.update({
				tests_quota: openPeriod.pre_pause_quota.testsQuota,
				tokens_quota: openPeriod.pre_pause_quota.tokensQuota,
				pre_pause_quota: null,
			})
			.eq("id", openPeriod.id);
	}

	await admin.from("practice_analytics_events").insert({
		student_id: profileId,
		event_name: "subscription_resumed",
		props: { subscription_id: sub.id, admin_initiated: true },
	});

	return { ok: true };
}
