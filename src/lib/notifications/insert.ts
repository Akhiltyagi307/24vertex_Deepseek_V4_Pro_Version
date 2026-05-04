import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { notifications } from "@/db/schema/comms-audit";
import { logServerError } from "@/lib/server/log-supabase-error";

/**
 * Hard cap on `notifications.title` text written to the in-app feed. Mirrors the
 * schema constraint (`varchar(300)`); we slice rather than reject so a noisy
 * upstream caller never poisons the bell with a DB error.
 */
export const MAX_NOTIFICATION_TITLE_LEN = 300;

/**
 * Hard cap on `notifications.body` text written to the in-app feed. The
 * Postgres column is `text` (unbounded), so this is a product cap — the bell
 * UI doesn't render anything more than this anyway, and capping in code stops
 * a runaway template from filling the table with multi-megabyte rows.
 */
export const MAX_NOTIFICATION_BODY_LEN = 8000;
import {
	getNotificationPrefs,
	isInAppAllowed,
	type NotificationPrefs,
} from "@/lib/notifications/prefs";
import {
	preferenceKeyForRow,
	type NotificationCategory,
	type NotificationType,
} from "@/lib/notifications/types";

export type InsertInAppInput = {
	recipientId: string;
	senderId?: string | null;
	title: string;
	body: string;
	type: NotificationType;
	category?: NotificationCategory | string | null;
	referenceType?: string | null;
	referenceId?: string | null;
	/** Student profile this notification is about (parent portal). */
	contextStudentId?: string | null;
	priority?: "normal" | "urgent";
	/** If provided, skips the per-user fetch. */
	prefs?: NotificationPrefs;
	/**
	 * When true, writes the row even if the user disabled in-app notifications or
	 * opted out of this type. Use only for high-trust account/security signals.
	 */
	forceInApp?: boolean;
};

/**
 * Inserts a `notifications` row for a single recipient, honoring the user's
 * `user_preferences` (in-app master switch + per-type opt-in).
 *
 * Returns the inserted row id when the notification was written, `null` when
 * the preference gate blocked it, and `null` on failure (errors are logged;
 * callers on hot paths should never throw).
 */
export async function insertInAppNotification(input: InsertInAppInput): Promise<string | null> {
	if (!input.forceInApp) {
		const prefs = input.prefs ?? (await getNotificationPrefs(input.recipientId));
		const key = preferenceKeyForRow({ type: input.type, category: input.category ?? null });
		if (!isInAppAllowed(prefs, key)) return null;
	}

	try {
		const rows = await db
			.insert(notifications)
			.values({
				recipientId: input.recipientId,
				senderId: input.senderId ?? null,
				title: input.title.slice(0, MAX_NOTIFICATION_TITLE_LEN),
				body: input.body.slice(0, MAX_NOTIFICATION_BODY_LEN),
				type: input.type,
				priority: input.priority ?? "normal",
				category: input.category ?? null,
				referenceType: input.referenceType ?? null,
				referenceId: input.referenceId ?? null,
				contextStudentId: input.contextStudentId ?? null,
			})
			.returning({ id: notifications.id });
		return rows[0]?.id ?? null;
	} catch (err) {
		logServerError("notifications.insert", err, {
			recipientId: input.recipientId,
			type: input.type,
			category: input.category ?? "",
		});
		return null;
	}
}

/**
 * Marks an existing `notifications` row as "email also went out" so the bell UI
 * and admin tooling can answer "did the user receive an email for this?". The
 * `email_sent` / `email_sent_at` columns were defined on the schema but never
 * written before this — callers that fan out an in-app + email pair should now
 * call this after a successful send.
 *
 * Failures only log; the email has already gone out and we don't want to
 * surface a write error to a hot path.
 */
export async function markNotificationEmailSent(notificationId: string): Promise<void> {
	try {
		await db
			.update(notifications)
			.set({ emailSent: true, emailSentAt: new Date() })
			.where(eq(notifications.id, notificationId));
	} catch (err) {
		logServerError("notifications.mark_email_sent", err, { notificationId });
	}
}

export type NotificationLookupForEmailRef = {
	recipientId: string;
	referenceType: string;
	referenceId: string;
	category: string;
};

/**
 * Convenience for flows where the email send happens out-of-band from the
 * `insertInAppNotification` call (e.g. report-ready, where the in-app row is
 * written by the grader and the email is sent later by the PDF pipeline).
 * Returns the row id if a match exists, else `null`.
 */
export async function findNotificationIdForEmailRef(
	ref: NotificationLookupForEmailRef,
): Promise<string | null> {
	try {
		const rows = await db
			.select({ id: notifications.id })
			.from(notifications)
			.where(
				and(
					eq(notifications.recipientId, ref.recipientId),
					eq(notifications.referenceType, ref.referenceType),
					eq(notifications.referenceId, ref.referenceId),
					eq(notifications.category, ref.category),
				),
			)
			.limit(1);
		return rows[0]?.id ?? null;
	} catch (err) {
		logServerError("notifications.find_for_email_ref", err, ref);
		return null;
	}
}
