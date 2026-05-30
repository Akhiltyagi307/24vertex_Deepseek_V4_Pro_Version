import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { beginCronRun, completeCronRun, readIdempotencyKey } from "@/lib/internal/cron-idempotency";
import { writeAdminAction } from "@/lib/admin/audit";
import { utcIsoWeekKey } from "@/lib/admin/digest/week-key";
import { buildAdminWeeklyDigestHtml } from "@/lib/admin/digest/weekly";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";
import { getAdminNotificationRecipients } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_ROUTE = "/api/internal/admin/weekly-digest";

type DigestDedupResult = { sent: boolean; readError: string | null };

async function digestAlreadySentThisWeek(digestWeek: string): Promise<DigestDedupResult> {
	const admin = createServiceRoleClient();
	const { data, error } = await admin
		.from("admin_action_log")
		.select("id")
		.eq("action", "admin_weekly_digest_sent")
		.filter("payload->>digest_week", "eq", digestWeek)
		.limit(1)
		.maybeSingle();
	if (error) {
		// Fail-closed: if we can't confirm whether we sent the digest already,
		// skip this run rather than risk a duplicate landing in the admin
		// inbox. Cron runs daily, so a real send will catch up tomorrow.
		return { sent: false, readError: error.message ?? "audit log read failed" };
	}
	return { sent: Boolean(data?.id), readError: null };
}

async function runWeeklyDigest(request: Request): Promise<Response> {
	// Belt-and-braces dedup. The per-week guard below queries
	// admin_action_log for an existing send and is the canonical "did this
	// week already go out?" check. The cron_run_log layer here additionally
	// short-circuits BEFORE we build the digest HTML when pg_cron double-
	// fires within the same tick (e.g. failover). Without it, both fires
	// pay to render the digest before only the first one passes the
	// per-week guard.
	const idempotencyKey = readIdempotencyKey(request);
	const claim = await beginCronRun({ cronRoute: CRON_ROUTE, key: idempotencyKey });
	if (claim.kind === "duplicate") {
		return Response.json({
			ok: true,
			deduped: true,
			first_seen_at: claim.firstSeenAt,
			completed_at: claim.completedAt,
		});
	}

	const recipients = getAdminNotificationRecipients();
	if (recipients.length === 0) {
		return Response.json(
			{ success: false, ok: false, message: "No admin notification recipients configured (ADMIN_NOTIFICATION_EMAILS or ADMIN_EMAIL)." },
			{ status: 500 },
		);
	}

	const digestWeek = utcIsoWeekKey();
	const dedup = await digestAlreadySentThisWeek(digestWeek);
	if (dedup.readError) {
		return Response.json(
			{ success: false, ok: false, skipped: true, digest_week: digestWeek, reason: "dedup_check_failed", error: dedup.readError },
			{ status: 503 },
		);
	}
	if (dedup.sent) {
		if (claim.kind === "fresh" && idempotencyKey) {
			await completeCronRun({ key: idempotencyKey, result: { skipped: true, reason: "already_sent_this_week" } });
		}
		return Response.json({ ok: true, skipped: true, digest_week: digestWeek });
	}

	const { subject, html } = await buildAdminWeeklyDigestHtml();

	// Fan out across the admin DL. Track per-recipient errors but proceed
	// even when a single address bounces — better to deliver to the rest of
	// the team than to skip the whole week.
	const results = await Promise.allSettled(
		recipients.map((to) =>
			sendHtmlEmailLogged({
				to,
				subject,
				html,
				templateSlug: "admin-weekly-digest",
				templateVariables: {},
			}),
		),
	);
	const sentTo: string[] = [];
	const failed: { to: string; error: string }[] = [];
	results.forEach((r, idx) => {
		const to = recipients[idx];
		if (r.status === "fulfilled" && !r.value.error) sentTo.push(to);
		else failed.push({ to, error: r.status === "fulfilled" ? r.value.error ?? "unknown" : String(r.reason) });
	});

	if (sentTo.length === 0) {
		return Response.json(
			{ success: false, ok: false, message: "All admin recipients failed.", failed, digest_week: digestWeek },
			{ status: 500 },
		);
	}

	await writeAdminAction({
		action: "admin_weekly_digest_sent",
		payload: { to: sentTo, failed, digest_week: digestWeek },
		userAgent: request.headers.get("user-agent"),
	});

	if (claim.kind === "fresh" && idempotencyKey) {
		await completeCronRun({
			key: idempotencyKey,
			result: { digest_week: digestWeek, sent_to: sentTo.length, failed: failed.length },
		});
	}

	return Response.json({ ok: true, digest_week: digestWeek, sent_to: sentTo, failed });
}

export async function POST(request: Request) {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;
	return runWeeklyDigest(request);
}

export async function GET(request: Request) {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;
	return runWeeklyDigest(request);
}
