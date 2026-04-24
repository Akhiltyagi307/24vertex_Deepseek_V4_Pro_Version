"use server";

import { revalidatePath } from "next/cache";

import { cancelSubscription } from "@/lib/billing/razorpay";
import { PLAN_CATALOG, tokenQuotaForGrade } from "@/lib/billing/plans";
import { recordPracticeEvent } from "@/lib/practice/analytics";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type RedeemCouponResult =
	| { ok: true; message: string }
	| {
			ok: false;
			code:
				| "unauthorized"
				| "invalid_code"
				| "inactive"
				| "expired"
				| "exhausted"
				| "already_redeemed"
				| "blocked_paid"
				| "database_error";
			message: string;
		};

const INVALID = "This coupon code is not recognised.";

/**
 * Redeems a shared campaign coupon code. On success, grants `duration_days` of
 * the coupon's plan (Pro Monthly by default) without charging via Razorpay.
 *
 * Students who are already on an active paid subscription cannot stack a
 * coupon on top — we block them and suggest waiting until the subscription
 * ends or cancelling first.
 */
export async function redeemCoupon(rawCode: string): Promise<RedeemCouponResult> {
	const code = rawCode.trim().toUpperCase();
	if (!code || code.length > 40) {
		return { ok: false, code: "invalid_code", message: INVALID };
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return { ok: false, code: "unauthorized", message: "Sign in to redeem a coupon." };
	}
	const admin = createServiceRoleClient();

	const { data: coupon, error: cErr } = await admin
		.from("coupons")
		.select("id, code, is_active, max_redemptions, redemptions_count, duration_days, grants_plan_code, expires_at")
		.eq("code", code)
		.maybeSingle();
	if (cErr || !coupon) {
		return { ok: false, code: "invalid_code", message: INVALID };
	}
	if (!coupon.is_active) {
		return { ok: false, code: "inactive", message: "This coupon is no longer active." };
	}
	if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
		return { ok: false, code: "expired", message: "This coupon has expired." };
	}
	if (coupon.redemptions_count >= coupon.max_redemptions) {
		return { ok: false, code: "exhausted", message: "This coupon has been fully redeemed." };
	}

	const { data: already } = await admin
		.from("coupon_redemptions")
		.select("id")
		.eq("coupon_id", coupon.id)
		.eq("profile_id", user.id)
		.maybeSingle();
	if (already) {
		return { ok: false, code: "already_redeemed", message: "You have already redeemed this coupon." };
	}

	const { data: sub } = await admin
		.from("subscriptions")
		.select("id, status")
		.eq("profile_id", user.id)
		.maybeSingle();
	if (sub && (sub.status === "active" || sub.status === "grace" || sub.status === "past_due")) {
		return {
			ok: false,
			code: "blocked_paid",
			message: "You already have an active paid subscription. Cancel it first to redeem this coupon.",
		};
	}

	const grant = coupon.grants_plan_code as keyof typeof PLAN_CATALOG;
	const plan = PLAN_CATALOG[grant] ?? PLAN_CATALOG.pro_monthly;

	const { data: profile } = await admin
		.from("profiles")
		.select("grade")
		.eq("id", user.id)
		.maybeSingle();

	const now = new Date();
	const end = new Date(now.getTime() + coupon.duration_days * 86_400_000);

	let subId = sub?.id;
	if (!subId) {
		const { data: newSub, error: insErr } = await admin
			.from("subscriptions")
			.insert({
				profile_id: user.id,
				plan_code: grant,
				status: "coupon",
				current_period_start: now.toISOString(),
				current_period_end: end.toISOString(),
			})
			.select("id")
			.single();
		if (insErr || !newSub) {
			logSupabaseError("billing.redeem_coupon.insert_sub", insErr, { userId: user.id });
			return { ok: false, code: "database_error", message: "Could not apply coupon. Try again later." };
		}
		subId = newSub.id;
	} else {
		const { error: updErr } = await admin
			.from("subscriptions")
			.update({
				plan_code: grant,
				status: "coupon",
				current_period_start: now.toISOString(),
				current_period_end: end.toISOString(),
				cancel_at_period_end: false,
				updated_at: now.toISOString(),
			})
			.eq("id", subId);
		if (updErr) {
			logSupabaseError("billing.redeem_coupon.update_sub", updErr, { userId: user.id });
			return { ok: false, code: "database_error", message: "Could not apply coupon. Try again later." };
		}
	}

	await admin.from("usage_periods").upsert(
		{
			subscription_id: subId,
			profile_id: user.id,
			period_start: now.toISOString(),
			period_end: end.toISOString(),
			tests_quota: plan.testsPerPeriod,
			tests_used: 0,
			tokens_quota: tokenQuotaForGrade(plan, profile?.grade ?? null),
			tokens_used: 0,
		},
		{ onConflict: "subscription_id,period_start" },
	);

	// Single-use enforcement via UPDATE...WHERE so we never double-increment.
	const { data: incResult, error: incErr } = await admin
		.from("coupons")
		.update({ redemptions_count: coupon.redemptions_count + 1 })
		.eq("id", coupon.id)
		.eq("redemptions_count", coupon.redemptions_count)
		.select("id")
		.maybeSingle();
	if (incErr || !incResult) {
		// Another concurrent redeem bumped the counter; retry-friendly.
		return { ok: false, code: "exhausted", message: "This coupon was just fully redeemed. Please try another." };
	}

	await admin.from("coupon_redemptions").insert({
		coupon_id: coupon.id,
		profile_id: user.id,
		subscription_id: subId ?? null,
	});

	void recordPracticeEvent(
		supabase,
		"coupon_redeemed",
		{ code, plan_code: grant, duration_days: coupon.duration_days },
		{ studentId: user.id },
	);

	revalidatePath("/student", "layout");
	revalidatePath("/student/subscription");
	revalidatePath("/student/settings");

	return {
		ok: true,
		message: `Coupon applied! You have ${coupon.duration_days} days of ${plan.name} access.`,
	};
}

export type CancelSubscriptionResult = { ok: true } | { ok: false; message: string };

/**
 * Flips `cancel_at_period_end=true` on both Razorpay and our own subscription
 * row. The student keeps access until `current_period_end`; the
 * `subscription.cancelled` webhook finalises `status=cancelled` when that
 * date arrives.
 */
export async function cancelAtPeriodEnd(): Promise<CancelSubscriptionResult> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { ok: false, message: "Sign in to manage your subscription." };

	const admin = createServiceRoleClient();
	const { data: sub } = await admin
		.from("subscriptions")
		.select("id, razorpay_subscription_id")
		.eq("profile_id", user.id)
		.maybeSingle();
	if (!sub) return { ok: false, message: "No subscription found." };
	if (!sub.razorpay_subscription_id) {
		return { ok: false, message: "You don't have a paid subscription to cancel." };
	}

	try {
		await cancelSubscription(sub.razorpay_subscription_id, { cancelAtCycleEnd: true });
	} catch (e) {
		logServerError("billing.cancel_action.rzp", e);
		return { ok: false, message: "Razorpay refused the cancellation. Try again in a moment." };
	}

	await admin
		.from("subscriptions")
		.update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
		.eq("id", sub.id);

	void recordPracticeEvent(
		supabase,
		"subscription_cancelled",
		{ soft: true, source: "subscription_page" },
		{ studentId: user.id },
	);

	revalidatePath("/student", "layout");
	revalidatePath("/student/subscription");
	revalidatePath("/student/settings");
	return { ok: true };
}
