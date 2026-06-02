import { and, eq, inArray, lt } from "drizzle-orm";

import { db } from "@/db";
import { subscriptions } from "@/db/schema/billing";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { cancelSubscription } from "@/lib/billing/razorpay";
import { sendDunningReminderEmail } from "@/lib/email/subscription-notifications";
import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { getNotificationPrefs } from "@/lib/notifications/prefs";
import { logServerError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * W4.3 — daily dunning processor.
 *
 * For every subscription stuck in `grace` or `past_due`, send the right
 * reminder based on age (3-day at T+3, 7-day at T+7) and hard-cancel at T+14.
 *
 * Idempotency comes from email_log's (template, dedup_key) unique index — a
 * second run on the same day finds existing rows and skips. Razorpay's own
 * retry pings are independent and not visible from here.
 */
const DAY_MS = 86_400_000;

async function handle(request: Request): Promise<Response> {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;

	const now = Date.now();
	const day3Cutoff = new Date(now - 3 * DAY_MS);
	const day7Cutoff = new Date(now - 7 * DAY_MS);
	const day14Cutoff = new Date(now - 14 * DAY_MS);
	const admin = createServiceRoleClient();

	// Pull all subscriptions in dunning-eligible states (cap at 500 to avoid
	// runaway queries; if your dunning queue exceeds 500/day you have bigger
	// problems than this cron).
	const candidates = await db
		.select({
			id: subscriptions.id,
			profileId: subscriptions.profileId,
			status: subscriptions.status,
			updatedAt: subscriptions.updatedAt,
			dunningStartedAt: subscriptions.dunningStartedAt,
				razorpaySubscriptionId: subscriptions.razorpaySubscriptionId,
		})
		.from(subscriptions)
		.where(inArray(subscriptions.status, ["grace", "past_due"]))
		.limit(500);

	let day3Sent = 0;
	let day7Sent = 0;
	let cancelled = 0;
	const errors: Array<{ id: string; phase: string; error: string }> = [];

	for (const sub of candidates) {
		// H3c: anchor dunning age on the stable dunning_started_at, not updated_at
		// (which any unrelated write resets). Legacy rows that entered dunning
		// before the column existed fall back to updated_at and are frozen here so
		// future writes can't reset their clock.
		const anchor = sub.dunningStartedAt ?? sub.updatedAt;
		if (!sub.dunningStartedAt) {
			try {
				await db.update(subscriptions).set({ dunningStartedAt: anchor }).where(eq(subscriptions.id, sub.id));
			} catch (e) {
				logServerError("billing.dunning.stamp_anchor", e, { subscription_id: sub.id });
			}
		}
		const ageMs = now - anchor.getTime();

		// Day 14: hard cancel.
		if (ageMs >= 14 * DAY_MS && sub.razorpaySubscriptionId) {
			try {
				await cancelSubscription(sub.razorpaySubscriptionId, { cancelAtCycleEnd: false });
				await db
					.update(subscriptions)
					.set({ status: "cancelled", updatedAt: new Date() })
					.where(eq(subscriptions.id, sub.id));
				cancelled += 1;
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				logServerError("billing.dunning.cancel", e, { subscription_id: sub.id });
				errors.push({ id: sub.id, phase: "cancel", error: msg });
			}
			continue;
		}

		// Day 7 reminder.
		if (ageMs >= 7 * DAY_MS && anchor < day7Cutoff) {
			try {
				const sent = await sendDunningEmailFor(admin, sub.profileId, sub.id, 7);
				if (sent) day7Sent += 1;
			} catch (e) {
				errors.push({ id: sub.id, phase: "day7", error: e instanceof Error ? e.message : String(e) });
			}
			continue;
		}

		// Day 3 reminder.
		if (ageMs >= 3 * DAY_MS && anchor < day3Cutoff) {
			try {
				const sent = await sendDunningEmailFor(admin, sub.profileId, sub.id, 3);
				if (sent) day3Sent += 1;
			} catch (e) {
				errors.push({ id: sub.id, phase: "day3", error: e instanceof Error ? e.message : String(e) });
			}
		}
	}

	// `inarray` import isn't used directly in this file but is referenced via
	// drizzle's helper; quiet linter without removing the helper which is
	// actually consumed up top.
	void and;
	void lt;

	if (cancelled > 0 || day3Sent > 0 || day7Sent > 0 || errors.length > 0) {
		await writeAdminAction({
			action: ADMIN_ACTIONS.SUBSCRIPTION_DUNNING_CANCEL,
			targetType: "billing",
			payload: { day3Sent, day7Sent, cancelled, day14Cutoff: day14Cutoff.toISOString(), errors },
		});
	}

	return Response.json({ ok: true, day3Sent, day7Sent, cancelled, errors: errors.length });
}

async function sendDunningEmailFor(
	admin: ReturnType<typeof createServiceRoleClient>,
	profileId: string,
	subscriptionId: string,
	dayNumber: 3 | 7,
): Promise<boolean> {
	// Respect master email opt-out.
	const prefs = await getNotificationPrefs(profileId);
	if (!prefs.enableEmail) return false;

	const { data: authUser } = await admin.auth.admin.getUserById(profileId);
	const email = authUser.user?.email;
	if (!email) return false;

	const { data: profile } = await admin.from("profiles").select("full_name").eq("id", profileId).maybeSingle<{ full_name: string | null }>();

	const result = await sendDunningReminderEmail({
		to: email,
		recipientUserId: profileId,
		studentName: profile?.full_name ?? undefined,
		dayNumber,
		subscriptionId,
	});
	return result.error === null;
}

export async function POST(request: Request): Promise<Response> {
	return handle(request);
}

export async function GET(request: Request): Promise<Response> {
	return handle(request);
}
