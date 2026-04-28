import { z } from "zod";

import {
	createOrFetchCustomer,
	createSubscription,
} from "@/lib/billing/razorpay";
import { isPlanCode } from "@/lib/billing/plans";
import { recordPracticeEvent } from "@/lib/practice/analytics";
import { logSupabaseError, logServerError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
	planCode: z.enum(["pro_monthly", "pro_annual"]),
	/**
	 * `immediate` creates the subscription and starts the mandate flow at once.
	 * `after_trial` defers the first charge to `trialEndsAt` for students still
	 * inside the 14-day free trial window (hybrid "skip the wait" flow).
	 */
	startMode: z.enum(["immediate", "after_trial"]).default("immediate"),
	/** When set, a verified parent may purchase for this student profile instead of self. */
	billingProfileId: z.string().uuid().optional(),
});

/**
 * Creates a Razorpay Subscription and returns the id + short_url so the client
 * can either open Razorpay Checkout in-page or redirect to the hosted flow.
 */
export async function POST(req: Request) {
	const json = await req.json().catch(() => null);
	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) {
		return Response.json({ ok: false, message: "Invalid request." }, { status: 400 });
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	const admin = createServiceRoleClient();

	const { data: plan, error: planErr } = await admin
		.from("plans")
		.select("code, razorpay_plan_id, price_paise, interval")
		.eq("code", parsed.data.planCode)
		.maybeSingle();
	if (planErr || !plan) {
		if (planErr) logSupabaseError("billing.create-subscription.plan", planErr, { planCode: parsed.data.planCode });
		return Response.json({ ok: false, message: "Plan not found." }, { status: 400 });
	}
	if (!plan.razorpay_plan_id) {
		return Response.json(
			{
				ok: false,
				message: "This plan is not yet configured in Razorpay. Run pnpm razorpay:seed-plans and persist the returned plan id.",
			},
			{ status: 500 },
		);
	}
	if (!isPlanCode(plan.code)) {
		return Response.json({ ok: false, message: "Invalid plan code." }, { status: 500 });
	}

	const { data: callerProfile } = await admin
		.from("profiles")
		.select("role")
		.eq("id", user.id)
		.maybeSingle();

	let targetProfileId = user.id;
	if (parsed.data.billingProfileId) {
		if (callerProfile?.role !== "parent" || parsed.data.billingProfileId === user.id) {
			return Response.json({ ok: false, message: "Not allowed to bill this account." }, { status: 403 });
		}
		const { data: linkRow } = await supabase
			.from("parent_student_links")
			.select("student_id")
			.eq("parent_id", user.id)
			.eq("student_id", parsed.data.billingProfileId)
			.eq("status", "active")
			.maybeSingle();
		if (!linkRow) {
			return Response.json({ ok: false, message: "Student not linked to your account." }, { status: 403 });
		}
		const { data: billedProfile } = await admin
			.from("profiles")
			.select("role")
			.eq("id", parsed.data.billingProfileId)
			.maybeSingle();
		if (billedProfile?.role !== "student") {
			return Response.json({ ok: false, message: "Invalid billing profile." }, { status: 400 });
		}
		targetProfileId = parsed.data.billingProfileId;
	}

	const { data: profile } = await admin
		.from("profiles")
		.select("full_name, phone, parent_email")
		.eq("id", targetProfileId)
		.maybeSingle();

	const { data: subRow, error: subErr } = await admin
		.from("subscriptions")
		.select("id, razorpay_customer_id, razorpay_subscription_id, status, trial_ends_at")
		.eq("profile_id", targetProfileId)
		.maybeSingle();
	if (subErr || !subRow) {
		if (subErr) logSupabaseError("billing.create-subscription.sub", subErr, { profileId: targetProfileId });
		return Response.json({ ok: false, message: "Subscription record missing." }, { status: 500 });
	}

	const paidPipelineBlocking =
		(subRow.status === "active" || subRow.status === "grace" || subRow.status === "past_due") &&
		Boolean(subRow.razorpay_subscription_id);
	if (paidPipelineBlocking) {
		const billedForChild = targetProfileId !== user.id;
		return Response.json(
			{
				ok: false,
				message: billedForChild
					? "This student already has an active paid subscription. Use Razorpay or cancel at period end before starting a new checkout."
					: "You already have an active billing subscription. Open Subscription to manage payment or change plans.",
			},
			{ status: 409 },
		);
	}

	let customer;
	try {
		customer = await createOrFetchCustomer({
			existingCustomerId: subRow.razorpay_customer_id ?? undefined,
			name: profile?.full_name ?? "EduAI student",
			email: user.email ?? "",
			contact: profile?.phone ?? undefined,
			notes: { profile_id: targetProfileId },
		});
	} catch (e) {
		logServerError("billing.create-subscription.customer", e);
		return Response.json({ ok: false, message: "Could not create Razorpay customer." }, { status: 500 });
	}

	// Monthly plans renew for 10 years (≈120 cycles); annual for 10 years (10 cycles).
	const totalCount = plan.interval === "year" ? 10 : 120;
	let startAt: number | undefined;
	if (parsed.data.startMode === "after_trial" && subRow.trial_ends_at) {
		const trialEndSec = Math.floor(new Date(subRow.trial_ends_at).getTime() / 1000);
		if (trialEndSec > Math.floor(Date.now() / 1000) + 60) {
			startAt = trialEndSec;
		}
	}

	let razorpaySubscription;
	try {
		razorpaySubscription = await createSubscription({
			planId: plan.razorpay_plan_id,
			totalCount,
			startAt,
			customerId: customer.id,
			notes: { profile_id: targetProfileId, plan_code: plan.code },
		});
	} catch (e) {
		logServerError("billing.create-subscription.rzp", e);
		return Response.json({ ok: false, message: "Could not start Razorpay checkout." }, { status: 502 });
	}

	const { error: updErr } = await admin
		.from("subscriptions")
		.update({
			razorpay_customer_id: customer.id,
			razorpay_subscription_id: razorpaySubscription.id,
			pending_plan_code: plan.code,
			updated_at: new Date().toISOString(),
		})
		.eq("profile_id", targetProfileId);
	if (updErr) {
		logSupabaseError("billing.create-subscription.update", updErr, { profileId: targetProfileId });
	}

	void recordPracticeEvent(
		supabase,
		"upgrade_clicked",
		{ plan_code: plan.code, start_mode: parsed.data.startMode, billed_by_parent: callerProfile?.role === "parent" },
		{ studentId: targetProfileId },
	);

	return Response.json({
		ok: true,
		subscriptionId: razorpaySubscription.id,
		shortUrl: razorpaySubscription.short_url ?? null,
		razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID ?? null,
	});
}
