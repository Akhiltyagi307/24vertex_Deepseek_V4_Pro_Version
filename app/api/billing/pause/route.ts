import { getApiRequestUser } from "@/lib/auth/api-request-user";
import { pauseSubscription } from "@/lib/billing/razorpay";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { rlConsume } from "@/lib/ratelimit/consume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_PER_MIN = 5;
const RATE_WINDOW_SEC = 60;

/**
 * W4.2 — pause an active subscription.
 *
 * Razorpay pauses billing; we mirror it locally by setting status='paused'
 * and zeroing the open usage_periods quota (saving the originals to
 * pre_pause_quota for resume). The subscription.paused webhook then confirms.
 *
 * 30 days paused → auto-cancel via the W4.2 cron.
 */
export async function POST(req: Request) {
	const auth = await getApiRequestUser(req);
	if (!auth) return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	const { user } = auth;

	const rl = await rlConsume({
		key: `pause:user:${user.id}`,
		limit: RATE_LIMIT_PER_MIN,
		windowSec: RATE_WINDOW_SEC,
	});
	if (!rl.allowed) {
		return Response.json(
			{ ok: false, code: "rate_limited", message: "Too many pause attempts." },
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
		if (subErr) logSupabaseError("billing.pause.sub", subErr);
		return Response.json({ ok: false, message: "Subscription not found." }, { status: 404 });
	}
	if (!sub.razorpay_subscription_id) {
		return Response.json({ ok: false, message: "Subscription not linked to Razorpay." }, { status: 409 });
	}
	if (sub.status === "paused") {
		return Response.json({ ok: true, deduped: true });
	}
	if (sub.status !== "active") {
		return Response.json(
			{ ok: false, code: "wrong_status", message: `Pause requires active status (got ${sub.status}).` },
			{ status: 409 },
		);
	}

	try {
		await pauseSubscription(sub.razorpay_subscription_id, { pauseAt: "now" });
	} catch (e) {
		logServerError("billing.pause.razorpay", e);
		return Response.json({ ok: false, message: "Razorpay rejected the pause." }, { status: 502 });
	}

	// Mirror state locally and stash quota for restoration on resume.
	const now = new Date().toISOString();
	await admin
		.from("subscriptions")
		.update({ status: "paused", paused_at: now, updated_at: now })
		.eq("id", sub.id);

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
		student_id: user.id,
		event_name: "subscription_paused",
		props: { subscription_id: sub.id },
	});

	return Response.json({ ok: true });
}
