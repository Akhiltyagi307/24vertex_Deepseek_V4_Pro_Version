import { revalidatePath } from "next/cache";
import { z } from "zod";

import { cancelSubscription } from "@/lib/billing/razorpay";
import { recordPracticeEvent } from "@/lib/practice/analytics";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cancelBodySchema = z.object({
	billingProfileId: z.string().uuid().optional(),
});

/**
 * Students call this to opt-out of renewal. Razorpay keeps the subscription
 * active until `current_period_end`; we mirror that here via
 * `cancel_at_period_end = true`. The `subscription.cancelled` webhook later
 * flips `status → cancelled` once the cycle actually ends.
 */
export async function POST(req: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	const rawBody = await req.json().catch(() => ({}));
	const parsedBody = cancelBodySchema.safeParse(rawBody);
	if (!parsedBody.success) {
		return Response.json({ ok: false, message: "Invalid request." }, { status: 400 });
	}
	const billingProfileId = parsedBody.data.billingProfileId;

	const admin = createServiceRoleClient();
	const { data: callerProfile } = await admin
		.from("profiles")
		.select("role")
		.eq("id", user.id)
		.maybeSingle();

	let targetProfileId = user.id;
	if (billingProfileId && billingProfileId !== user.id) {
		if (callerProfile?.role !== "parent") {
			return Response.json({ ok: false, message: "Forbidden." }, { status: 403 });
		}
		const { data: linkRow } = await supabase
			.from("parent_student_links")
			.select("student_id")
			.eq("parent_id", user.id)
			.eq("student_id", billingProfileId)
			.eq("status", "active")
			.maybeSingle();
		if (!linkRow) {
			return Response.json({ ok: false, message: "Student not linked." }, { status: 403 });
		}
		targetProfileId = billingProfileId;
	}

	const { data: sub, error } = await admin
		.from("subscriptions")
		.select("id, razorpay_subscription_id, status")
		.eq("profile_id", targetProfileId)
		.maybeSingle();
	if (error || !sub) {
		if (error) logSupabaseError("billing.cancel.load", error, { profileId: targetProfileId });
		return Response.json({ ok: false, message: "No subscription to cancel." }, { status: 404 });
	}
	if (!sub.razorpay_subscription_id) {
		return Response.json({ ok: false, message: "No paid subscription to cancel." }, { status: 400 });
	}

	try {
		await cancelSubscription(sub.razorpay_subscription_id, { cancelAtCycleEnd: true });
	} catch (e) {
		logServerError("billing.cancel.rzp", e);
		return Response.json({ ok: false, message: "Razorpay refused the cancellation." }, { status: 502 });
	}

	await admin
		.from("subscriptions")
		.update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
		.eq("id", sub.id);

	void recordPracticeEvent(
		supabase,
		"subscription_cancelled",
		{ soft: true, source: callerProfile?.role === "parent" ? "parent_portal" : "subscription_page" },
		{ studentId: targetProfileId },
	);

	revalidatePath("/student", "layout");
	revalidatePath("/student/subscription");
	revalidatePath("/parent", "layout");
	revalidatePath("/parent/subscription");

	return Response.json({ ok: true });
}
