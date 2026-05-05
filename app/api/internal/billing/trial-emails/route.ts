import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { beginCronRun, completeCronRun, readIdempotencyKey } from "@/lib/internal/cron-idempotency";
import { sendTrialEndingEmail } from "@/lib/email/subscription-notifications";
import { getNotificationPrefs } from "@/lib/notifications/prefs";
import { shouldSendTrialReminder } from "@/lib/notifications/should-send-trial-reminder";
import { logSupabaseError, logServerError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_ROUTE = "/api/internal/billing/trial-emails";

/**
 * Daily cron: sends "trial ending in N days" emails once per trial.
 *
 * Two layers of dedup:
 *   1. cron_run_log keyed on the `Idempotency-Key` header. A pg_cron double
 *      fire (failover, manual replay) sends the same key twice and the
 *      second invocation short-circuits without touching subscriptions.
 *   2. Per-subscription bucket tracking via `subscriptions.metadata
 *      .trial_emails_sent` — protects against the same student getting two
 *      reminders even across genuinely different cron ticks.
 *
 * Both layers are needed: the first protects against duplicate firings of
 * one tick; the second protects against legitimate re-runs that would
 * otherwise re-process the same in-window subscriptions.
 */
export async function POST(request: Request) {
	const unauth = assertCronRequestAuthorized(request);
	if (unauth) return unauth;
	return runTrialEmails(request);
}

export async function GET(request: Request) {
	const unauth = assertCronRequestAuthorized(request);
	if (unauth) return unauth;
	return runTrialEmails(request);
}

async function runTrialEmails(request: Request): Promise<Response> {
	const idempotencyKey = readIdempotencyKey(request);
	const claim = await beginCronRun({ cronRoute: CRON_ROUTE, key: idempotencyKey });
	if (claim.kind === "duplicate") {
		// Caller already ran this tick. Return 200 so pg_cron doesn't retry.
		return Response.json({
			ok: true,
			deduped: true,
			first_seen_at: claim.firstSeenAt,
			completed_at: claim.completedAt,
		});
	}
	const admin = createServiceRoleClient();
	const now = Date.now();
	const windowEnd = new Date(now + 4 * 86_400_000).toISOString();

	const { data: trials, error } = await admin
		.from("subscriptions")
		.select("id, profile_id, trial_ends_at, metadata, plan_code")
		.eq("status", "trialing")
		.lte("trial_ends_at", windowEnd)
		.limit(500);
	if (error) {
		logSupabaseError("billing.trial_emails.select", error);
		return Response.json({ ok: false }, { status: 500 });
	}

	let sent = 0;
	for (const sub of trials ?? []) {
		const end = sub.trial_ends_at ? Date.parse(sub.trial_ends_at) : 0;
		if (!end || end < now) continue;
		const daysLeft = Math.max(0, Math.ceil((end - now) / 86_400_000));
		const bucket = daysLeft <= 1 ? "1" : daysLeft <= 3 ? "3" : null;
		if (!bucket) continue;

		const meta = (sub.metadata ?? {}) as { trial_emails_sent?: string[] };
		const already = Array.isArray(meta.trial_emails_sent) ? meta.trial_emails_sent : [];
		if (already.includes(bucket)) continue;

		// Skip this bucket today when the user has opted out of reminders. We do
		// NOT append to trial_emails_sent — re-enabling Reminders before the
		// trial ends restores the next scheduled bucket rather than swallowing it.
		// Uses the "reminder" preference key (not "announcement") because trial
		// reminders are nudges, not product announcements.
		const prefs = await getNotificationPrefs(sub.profile_id);
		if (!shouldSendTrialReminder(prefs)) continue;

		const { data: profile } = await admin
			.from("profiles")
			.select("full_name")
			.eq("id", sub.profile_id)
			.maybeSingle();
		const { data: authUser } = await admin.auth.admin.getUserById(sub.profile_id);
		const email = authUser.user?.email;
		if (!email) continue;

		try {
			const { error: sendErr } = await sendTrialEndingEmail({
				to: email,
				recipientUserId: sub.profile_id,
				studentName: profile?.full_name ?? null,
				daysLeft,
			});
			if (sendErr) {
				logServerError("billing.trial_emails.send", sendErr, { subId: sub.id });
				continue;
			}
			await admin
				.from("subscriptions")
				.update({
					metadata: { ...meta, trial_emails_sent: [...already, bucket] },
					updated_at: new Date().toISOString(),
				})
				.eq("id", sub.id);
			sent += 1;
		} catch (e) {
			logServerError("billing.trial_emails.loop", e, { subId: sub.id });
		}
	}

	// Mark the run as complete so admin views can show duration + outcome.
	// Skipped when there was no key (claim.kind === "no_key") since there's
	// no row to update.
	if (claim.kind === "fresh" && idempotencyKey) {
		await completeCronRun({ key: idempotencyKey, result: { sent } });
	}

	return Response.json({ ok: true, sent });
}
