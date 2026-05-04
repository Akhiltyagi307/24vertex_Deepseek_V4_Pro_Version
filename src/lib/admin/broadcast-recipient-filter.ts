import "server-only";

import {
	isEmailAllowed,
	isInAppAllowed,
	type NotificationPrefs,
} from "@/lib/notifications/prefs";

export type BroadcastRecipientLike = {
	id: string;
	email: string | null;
	role: string;
};

export type BroadcastChannels = {
	inApp: boolean;
	email: boolean;
};

const DEFAULT_PREFS_FALLBACK: NotificationPrefs = {
	enableInApp: true,
	enableEmail: true,
	types: {
		test_result: true,
		announcement: true,
		reminder: true,
		usage_alert: true,
		system: true,
		encouragement: true,
	},
};

/**
 * Splits a broadcast recipient chunk into the subset that should receive the
 * in-app card and the subset that should receive the email. Both gates use the
 * shared "announcement" preference key.
 *
 * Recipients without prefs in the map fall through to defaults (allowed) — this
 * matches `getNotificationPrefsForUsers`, which fills in defaults for missing
 * rows. We re-default here as a belt-and-braces guard so a stale or partial map
 * cannot accidentally mute a user.
 */
export function filterAllowedBroadcastRecipients(
	recipients: BroadcastRecipientLike[],
	prefsByUserId: Map<string, NotificationPrefs>,
	channels: BroadcastChannels,
): { inAppAllowed: BroadcastRecipientLike[]; emailAllowed: BroadcastRecipientLike[] } {
	const inAppAllowed: BroadcastRecipientLike[] = [];
	const emailAllowed: BroadcastRecipientLike[] = [];

	for (const r of recipients) {
		const prefs = prefsByUserId.get(r.id) ?? DEFAULT_PREFS_FALLBACK;
		if (channels.inApp && isInAppAllowed(prefs, "announcement")) {
			inAppAllowed.push(r);
		}
		if (channels.email && r.email && r.email.includes("@") && isEmailAllowed(prefs, "announcement")) {
			emailAllowed.push(r);
		}
	}
	return { inAppAllowed, emailAllowed };
}
