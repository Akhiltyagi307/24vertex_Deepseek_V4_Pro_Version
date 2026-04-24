import { revalidatePath } from "next/cache";

import { cancelSubscription } from "@/lib/billing/razorpay";
import { recordPracticeEvent } from "@/lib/practice/analytics";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Students call this to opt-out of renewal. Razorpay keeps the subscription
 * active until `current_period_end`; we mirror that here via
 * `cancel_at_period_end = true`. The `subscription.cancelled` webhook later
 * flips `status → cancelled` once the cycle actually ends.
 */
export async function POST() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}
	const admin = createServiceRoleClient();
	const { data: sub, error } = await admin
		.from("subscriptions")
		.select("id, razorpay_subscription_id, status")
		.eq("profile_id", user.id)
		.maybeSingle();
	if (error || !sub) {
		if (error) logSupabaseError("billing.cancel.load", error, { userId: user.id });
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
		{ soft: true },
		{ studentId: user.id },
	);

	revalidatePath("/student", "layout");
	revalidatePath("/student/subscription");

	return Response.json({ ok: true });
}
