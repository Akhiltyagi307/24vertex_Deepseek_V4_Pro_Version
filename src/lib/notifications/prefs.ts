import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { userPreferences } from "@/db/schema/comms-audit";
import { logServerError } from "@/lib/server/log-supabase-error";
import { DEFAULT_NOTIFICATION_TYPES } from "@/lib/notifications/types";

export type NotificationPrefs = {
	/** Master switch for in-app cards/bell. */
	enableInApp: boolean;
	/** Master switch for transactional email sends. */
	enableEmail: boolean;
	/** Per-type opt-ins: keys from `preferenceKeyForRow`. */
	types: Record<string, boolean>;
};

const DEFAULT_PREFS: NotificationPrefs = {
	enableInApp: true,
	enableEmail: true,
	types: { ...DEFAULT_NOTIFICATION_TYPES },
};

/**
 * Reads `user_preferences` for a profile and returns effective notification
 * settings. Missing rows return defaults so first-signup users see
 * notifications without requiring a backfill migration.
 */
export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
	try {
		const rows = await db
			.select({
				enableInapp: userPreferences.enableInappNotifications,
				enableEmail: userPreferences.enableEmailNotifications,
				types: userPreferences.notificationTypes,
			})
			.from(userPreferences)
			.where(eq(userPreferences.userId, userId))
			.limit(1);

		const row = rows[0];
		if (!row) return DEFAULT_PREFS;

		const rawTypes = row.types as Record<string, unknown> | null;
		const types: Record<string, boolean> = { ...DEFAULT_NOTIFICATION_TYPES };
		if (rawTypes && typeof rawTypes === "object") {
			for (const [k, v] of Object.entries(rawTypes)) {
				types[k] = v !== false;
			}
		}

		return {
			enableInApp: row.enableInapp !== false,
			enableEmail: row.enableEmail !== false,
			types,
		};
	} catch (err) {
		logServerError("notifications.prefs.read", err, { userId });
		return DEFAULT_PREFS;
	}
}

/** Helper used by writers to gate a row before insert. */
export function isInAppAllowed(prefs: NotificationPrefs, preferenceKey: string): boolean {
	if (!prefs.enableInApp) return false;
	const explicit = prefs.types[preferenceKey];
	return explicit !== false;
}

/** Helper used by writers to gate an email send before calling Resend. */
export function isEmailAllowed(prefs: NotificationPrefs, preferenceKey: string): boolean {
	if (!prefs.enableEmail) return false;
	const explicit = prefs.types[preferenceKey];
	return explicit !== false;
}
