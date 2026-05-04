import "server-only";

import { eq, inArray } from "drizzle-orm";

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

/** DB row shape for merge (single-user or batch select). Exported for unit tests. */
export type UserPreferenceNotificationRow = {
	enableInapp: boolean | null;
	enableEmail: boolean | null;
	types: unknown;
};

/**
 * Merges `user_preferences` columns into effective {@link NotificationPrefs}.
 * Same rules as the historical inline `getNotificationPrefs` implementation.
 */
export function prefsFromUserPreferenceRow(row: UserPreferenceNotificationRow): NotificationPrefs {
	const rawTypes = row.types as Record<string, unknown> | null;
	const types: Record<string, boolean> = { ...DEFAULT_NOTIFICATION_TYPES };
	if (rawTypes && typeof rawTypes === "object") {
		for (const [k, v] of Object.entries(rawTypes)) {
			if (typeof v === "boolean") {
				types[k] = v;
			} else if (!(k in DEFAULT_NOTIFICATION_TYPES)) {
				types[k] = true;
			}
		}
	}

	return {
		enableInApp: row.enableInapp === true || row.enableInapp == null,
		enableEmail: row.enableEmail === true || row.enableEmail == null,
		types,
	};
}

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

		return prefsFromUserPreferenceRow(row);
	} catch (err) {
		logServerError("notifications.prefs.read", err, { userId });
		return DEFAULT_PREFS;
	}
}

/**
 * Batch-read prefs for many users in one query. Every requested id appears in
 * the map: missing DB rows get {@link DEFAULT_PREFS}. On failure, returns the
 * same all-defaults map (fail-open, same spirit as {@link getNotificationPrefs}).
 */
export async function getNotificationPrefsForUsers(
	userIds: string[],
): Promise<Map<string, NotificationPrefs>> {
	const map = new Map<string, NotificationPrefs>();
	const unique = [...new Set(userIds.filter((id) => id.length > 0))];
	if (unique.length === 0) {
		return map;
	}

	const cloneDefaults = (): NotificationPrefs => ({
		enableInApp: DEFAULT_PREFS.enableInApp,
		enableEmail: DEFAULT_PREFS.enableEmail,
		types: { ...DEFAULT_PREFS.types },
	});

	for (const id of unique) {
		map.set(id, cloneDefaults());
	}

	try {
		const rows = await db
			.select({
				userId: userPreferences.userId,
				enableInapp: userPreferences.enableInappNotifications,
				enableEmail: userPreferences.enableEmailNotifications,
				types: userPreferences.notificationTypes,
			})
			.from(userPreferences)
			.where(inArray(userPreferences.userId, unique));

		for (const row of rows) {
			map.set(
				row.userId,
				prefsFromUserPreferenceRow({
					enableInapp: row.enableInapp,
					enableEmail: row.enableEmail,
					types: row.types,
				}),
			);
		}
	} catch (err) {
		logServerError("notifications.prefs.read_batch", err, { count: unique.length });
	}

	return map;
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
