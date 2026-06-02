import { getApiRequestUser } from "@/lib/auth/api-request-user";
import { resumeSubscription } from "@/lib/billing/razorpay";
import { parsePrePauseQuota } from "@/lib/billing/pre-pause-quota";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { rlConsume } from "@/lib/ratelimit/consume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_PER_MIN = 5;
const RATE_WINDOW_SEC = 60;

/**
 * W4.2 — resume a paused subscription.
 */
export async function POST(req: Request) {
	const auth = await getApiRequestUser(req);
	if (!auth) return Response.json({ success: false, ok: false, message: "Unauthorized." }, { status: 401 });
	const { user } = auth;

	const rl = await rlConsume({
		key: `resume:user:${user.id}`,
		limit: RATE_LIMIT_PER_MIN,
		windowSec: RATE_WINDOW_SEC,
	});
	if (!rl.allowed) {
		return Response.json(
			{ success: false, ok: false, code: "rate_limited", message: "Too many resume attempts." },
			{ status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000))) } },
		);
	}

	const admin = createServiceRoleClient();
	const { data: sub, error: subErr } = await admin
		.from("subscriptions")
		.select("id, status, razorpay_subscription_id")
		.eq("profile_id", user.id)
		.maybeSingle<{ id: string; status: string; razorpay_subscription_id: string | null }>();
	if (subErr || !sub) {
		if (subErr) logSupabaseError("billing.resume.sub", subErr);
		return Response.json({ success: false, ok: false, message: "Subscription not found." }, { status: 404 });
	}
	if (!sub.razorpay_subscription_id) {
		return Response.json({ success: false, ok: false, message: "Subscription not linked to Razorpay." }, { status: 409 });
	}
	if (sub.status === "active") {
		return Response.json({ ok: true, deduped: true });
	}
	if (sub.status !== "paused") {
		return Response.json(
			{ success: false, ok: false, code: "wrong_status", message: `Resume requires paused status (got ${sub.status}).` },
			{ status: 409 },
		);
	}

	try {
		await resumeSubscription(sub.razorpay_subscription_id, { resumeAt: "now" });
	} catch (e) {
		logServerError("billing.resume.razorpay", e);
		return Response.json({ success: false, ok: false, message: "Razorpay rejected the resume." }, { status: 502 });
	}

	const now = new Date().toISOString();
	await admin
		.from("subscriptions")
		.update({ status: "active", paused_at: null, updated_at: now })
		.eq("id", sub.id);

	// Restore pre-pause quotas on the open period.
	const { data: openPeriod } = await admin
		.from("usage_periods")
		.select("id, pre_pause_quota")
		.eq("subscription_id", sub.id)
		.order("period_start", { ascending: false })
		.limit(1)
		.maybeSingle<{ id: string; pre_pause_quota: unknown }>();

	// M8: validate the JSONB shape before restoring into integer quota columns.
	const restoredQuota = parsePrePauseQuota(openPeriod?.pre_pause_quota);
	if (openPeriod && restoredQuota) {
		await admin
			.from("usage_periods")
			.update({
				tests_quota: restoredQuota.testsQuota,
				tokens_quota: restoredQuota.tokensQuota,
				pre_pause_quota: null,
			})
			.eq("id", openPeriod.id);
	}

	await admin.from("practice_analytics_events").insert({
		student_id: user.id,
		event_name: "subscription_resumed",
		props: { subscription_id: sub.id },
	});

	return Response.json({ ok: true });
}
