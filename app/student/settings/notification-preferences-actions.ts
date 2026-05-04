"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { userPreferences } from "@/db/schema/comms-audit";
import { getServerUser } from "@/lib/auth/get-server-user";
import { DEFAULT_NOTIFICATION_TYPES } from "@/lib/notifications/types";
import { logServerError } from "@/lib/server/log-supabase-error";

export type NotificationPreferencesState = { ok: boolean; error?: string };

/** Keys shown in the preferences UI and accepted from the client. */
export const NOTIFICATION_PREFERENCE_KEYS = [
	"test_result",
	"usage_alert",
	"announcement",
	"reminder",
] as const;

const payloadSchema = z.object({
	enableInApp: z.boolean(),
	enableEmail: z.boolean(),
	types: z.record(z.enum(NOTIFICATION_PREFERENCE_KEYS), z.boolean()),
});

/**
 * Upserts the signed-in student's notification preferences. Unknown keys are
 * ignored; missing keys fall back to `DEFAULT_NOTIFICATION_TYPES`.
 */
export async function updateNotificationPreferences(
	input: z.infer<typeof payloadSchema>,
): Promise<NotificationPreferencesState> {
	const parsed = payloadSchema.safeParse(input);
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
