import { z } from "zod";

import { NOTIFICATION_PREFERENCE_KEYS } from "@/lib/notifications/types";

/**
 * Canonical Zod schema for the student notification preferences payload.
 *
 * Keep this file as the single source of truth for both the payload shape and
 * the accepted `types` keys. Action handlers and any future API route that
 * mutates `user_preferences.notification_types` MUST import this schema rather
 * than re-declaring it — drift here previously allowed inconsistent keys to be
 * accepted in different code paths.
 */
export const notificationPreferencesPayloadSchema = z
	.object({
		enableInApp: z.boolean(),
		enableEmail: z.boolean(),
		types: z.record(z.enum(NOTIFICATION_PREFERENCE_KEYS), z.boolean()),
	})
	.strict();

export type NotificationPreferencesPayload = z.infer<
	typeof notificationPreferencesPayloadSchema
>;
