import type { NotificationPreferenceKey } from "@/lib/notifications/types";

export type NotificationPreferencesState = { ok: boolean; error?: string };

export type NotificationPreferencesInput = {
	enableInApp: boolean;
	enableEmail: boolean;
	types: Record<NotificationPreferenceKey, boolean>;
};

export type NotificationPreferencesInitial = NotificationPreferencesInput;
