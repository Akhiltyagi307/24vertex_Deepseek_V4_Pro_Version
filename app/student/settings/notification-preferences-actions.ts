"use server";

/**
 * Tenant boundary (D8): the upsert here is keyed exclusively by
 * `(await getServerUser()).id`. `notificationPreferencesPayloadSchema`
 * deliberately excludes any `userId` / `profileId` field so a forged payload
 * cannot redirect the write to another student's row. See
 * `tests/actions/student/settings-tenant-boundary.test.ts` for the codified
 * invariant.
 */

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { userPreferences } from "@/db/schema/comms-audit";
import { getServerUser } from "@/lib/auth/get-server-user";
import {
	notificationPreferencesPayloadSchema,
	type NotificationPreferencesPayload,
} from "@/lib/notifications/preferences-schema";
import {
	DEFAULT_NOTIFICATION_TYPES,
	NOTIFICATION_PREFERENCE_KEYS,
} from "@/lib/notifications/types";
import { logServerError } from "@/lib/server/log-supabase-error";

import type { NotificationPreferencesState } from "./notification-preferences-types";

/**
 * Upserts the signed-in student's notification preferences. Unknown keys are
 * ignored; missing keys fall back to `DEFAULT_NOTIFICATION_TYPES`.
 */
export async function updateNotificationPreferences(
	input: NotificationPreferencesPayload,
): Promise<NotificationPreferencesState> {
	const parsed = notificationPreferencesPayloadSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "Invalid preferences." };
	}
	const user = await getServerUser();
	if (!user) {
		return { ok: false, error: "Not signed in." };
	}

	const merged: Record<string, boolean> = { ...DEFAULT_NOTIFICATION_TYPES };
	for (const key of NOTIFICATION_PREFERENCE_KEYS) {
		merged[key] = parsed.data.types[key] ?? merged[key] ?? true;
	}

	try {
		const existing = await db
			.select({ id: userPreferences.id })
			.from(userPreferences)
			.where(eq(userPreferences.userId, user.id))
			.limit(1);

		if (existing.length === 0) {
			await db.insert(userPreferences).values({
				userId: user.id,
				enableInappNotifications: parsed.data.enableInApp,
				enableEmailNotifications: parsed.data.enableEmail,
				notificationTypes: merged,
			});
		} else {
			await db
				.update(userPreferences)
				.set({
					enableInappNotifications: parsed.data.enableInApp,
					enableEmailNotifications: parsed.data.enableEmail,
					notificationTypes: merged,
					updatedAt: new Date(),
				})
				.where(eq(userPreferences.userId, user.id));
		}

		revalidatePath("/student/settings");
		return { ok: true };
	} catch (err) {
		logServerError("student.notifications.prefs.update", err, { userId: user.id });
		return { ok: false, error: "We couldn't save your preferences. Try again." };
	}
}
