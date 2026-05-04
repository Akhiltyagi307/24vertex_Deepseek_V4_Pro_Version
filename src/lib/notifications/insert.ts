import "server-only";

import { db } from "@/db";
import { notifications } from "@/db/schema/comms-audit";
import { logServerError } from "@/lib/server/log-supabase-error";
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
				title: input.title.slice(0, 300),
				body: input.body.slice(0, 8000),
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
