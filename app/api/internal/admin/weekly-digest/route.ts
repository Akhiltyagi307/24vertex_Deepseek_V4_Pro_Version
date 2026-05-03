import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { utcIsoWeekKey } from "@/lib/admin/digest/week-key";
import { buildAdminWeeklyDigestHtml } from "@/lib/admin/digest/weekly";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function digestAlreadySentThisWeek(digestWeek: string): Promise<boolean> {
	const admin = createServiceRoleClient();
	const { data, error } = await admin
		.from("admin_action_log")
		.select("id")
		.eq("action", "admin_weekly_digest_sent")
		.filter("payload->>digest_week", "eq", digestWeek)
		.limit(1)
		.maybeSingle();
	if (error) {
		return false;
	}
	return Boolean(data?.id);
}

async function runWeeklyDigest(request: Request): Promise<Response> {
	const to = process.env.ADMIN_EMAIL?.trim();
	if (!to) {
		return Response.json({ ok: false, message: "ADMIN_EMAIL is not set." }, { status: 500 });
	}

	const digestWeek = utcIsoWeekKey();
	if (await digestAlreadySentThisWeek(digestWeek)) {
		return Response.json({ ok: true, skipped: true, digest_week: digestWeek });
	}

	const { subject, html } = await buildAdminWeeklyDigestHtml();
	const { error } = await sendHtmlEmailLogged({
		to,
		subject,
		html,
		templateSlug: "admin-weekly-digest",
		templateVariables: {},
	});

	if (error) {
		return Response.json({ ok: false, message: error }, { status: 500 });
	}

	await writeAdminAction({
		action: "admin_weekly_digest_sent",
		payload: { to, digest_week: digestWeek },
		userAgent: request.headers.get("user-agent"),
	});

	return Response.json({ ok: true, digest_week: digestWeek });
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
