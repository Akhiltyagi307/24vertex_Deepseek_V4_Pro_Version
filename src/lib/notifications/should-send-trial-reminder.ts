import "server-only";

import { isEmailAllowed, type NotificationPrefs } from "@/lib/notifications/prefs";

/**
 * Gate for `sendTrialEndingEmail`. The "Reminders" toggle in
 * `/student/settings` writes the `reminder` key in
 * `user_preferences.notification_types`; before this helper landed, that
 * toggle had no effect because no producer read it. Trial-ending emails are
 * the first (and currently only) producer bound to it.
 *
 * If/when other reminder flows ship (uncompleted-practice nudges,
 * upcoming-test pings, etc.), they should reuse this helper rather than each
 * writing `isEmailAllowed(prefs, "reminder")` inline.
 */
export function shouldSendTrialReminder(prefs: NotificationPrefs): boolean {
	return isEmailAllowed(prefs, "reminder");
}
