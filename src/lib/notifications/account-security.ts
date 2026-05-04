import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { profiles } from "@/db/schema/profiles";
import {
	sendAccountEmailChangedEmail,
	sendAccountPasswordChangedEmail,
	sendParentChildLinkConfirmedEmail,
	sendParentLinkedStudentEmail,
} from "@/lib/email/notifications-emails";
import { insertInAppNotification, markNotificationEmailSent } from "@/lib/notifications/insert";
import { getNotificationPrefs, isEmailAllowed } from "@/lib/notifications/prefs";
import { loadProfileContact } from "@/lib/notifications/report-ready";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import { logServerError } from "@/lib/server/log-supabase-error";

async function loadDisplayName(userId: string): Promise<string | null> {
	try {
		const rows = await db
			.select({ fullName: profiles.fullName })
			.from(profiles)
			.where(eq(profiles.id, userId))
			.limit(1);
		return rows[0]?.fullName?.trim() || null;
	} catch (err) {
		logServerError("notifications.account_security.display_name", err, { userId });
		return null;
	}
}

async function maybeSendSecurityEmail(params: {
	recipientId: string;
	prefsKey: "system";
	notificationId: string | null;
	send: (to: string, displayName: string | null) => Promise<{ error: string | null }>;
}): Promise<void> {
	const prefs = await getNotificationPrefs(params.recipientId);
	if (!isEmailAllowed(prefs, params.prefsKey)) return;
	const contact = await loadProfileContact(params.recipientId);
	if (!contact?.email) return;
	const { error } = await params.send(contact.email, contact.fullName);
	if (error) {
		logServerError("notifications.account_security.email", new Error(error), {
			recipientId: params.recipientId,
		});
		return;
	}
	if (params.notificationId) {
		await markNotificationEmailSent(params.notificationId);
	}
}

/**
 * Masks an email so the in-app card doesn't expose the full new address —
 * `john.doe@example.com` → `jo…@example.com`, `a@example.com` → `…@example.com`.
 * Returns null when the input is missing or doesn't look like an email at all.
 */
function maskEmailForDisplay(value: string | null | undefined): string | null {
	if (!value) return null;
	const at = value.indexOf("@");
	if (at <= 0) return null;
	const local = value.slice(0, at);
	const domain = value.slice(at + 1);
	if (!domain) return null;
	const prefix = local.length <= 2 ? "" : local.slice(0, 2);
	return `${prefix}…@${domain}`;
}

/**
 * After a successful password update (settings or recovery flow).
 */
export async function notifyPasswordChanged(recipientId: string): Promise<void> {
	try {
		const notificationId = await insertInAppNotification({
			recipientId,
			title: "Password changed",
			body: "Your EduAI account password was changed. If you did not do this, sign in and reset your password from Account settings, or contact support.",
			type: "system",
			category: "account_password_changed",
			forceInApp: true,
		});
		await maybeSendSecurityEmail({
			recipientId,
			prefsKey: "system",
			notificationId,
			send: (to, displayName) =>
				sendAccountPasswordChangedEmail({
					to,
					recipientUserId: recipientId,
					displayName,
				}),
		});
	} catch (err) {
		logServerError("notifications.password_changed", err, { recipientId });
	}
}

/**
 * After Supabase confirms a new sign-in email (email_change / verify flow).
 */
export async function notifyEmailChanged(recipientId: string, newEmail?: string | null): Promise<void> {
	try {
		const masked = maskEmailForDisplay(newEmail) ?? "your new address";
		const notificationId = await insertInAppNotification({
			recipientId,
			title: "Sign-in email updated",
			body: `Your account sign-in email is now ${masked}. If you did not request this change, contact support immediately.`,
			type: "system",
			category: "account_email_changed",
			forceInApp: true,
		});
		await maybeSendSecurityEmail({
			recipientId,
			prefsKey: "system",
			notificationId,
			send: (to, displayName) =>
				sendAccountEmailChangedEmail({
					to,
					recipientUserId: recipientId,
					displayName,
					newEmail: newEmail ?? undefined,
				}),
		});
	} catch (err) {
		logServerError("notifications.email_changed", err, { recipientId });
	}
}

export type NotifyParentLinkedInput = {
	studentId: string;
	parentId: string;
};

/**
 * Informs the student that a parent account successfully linked (guardian portal access).
 */
export async function notifyParentLinkedToStudent(input: NotifyParentLinkedInput): Promise<void> {
	try {
		const parentName = await loadDisplayName(input.parentId);
		const who = parentName ? ` (${parentName})` : "";
		const notificationId = await insertInAppNotification({
			recipientId: input.studentId,
			senderId: input.parentId,
			title: "Parent account linked",
			body: `A parent account was linked to your profile${who}. They can use the parent portal to view progress you share with them. If this was a mistake, ask a guardian or your school admin for help.`,
			type: "system",
			category: "parent_linked_student",
			referenceType: "profile",
			referenceId: input.parentId,
			forceInApp: true,
		});
		await maybeSendSecurityEmail({
			recipientId: input.studentId,
			prefsKey: "system",
			notificationId,
			send: (to, displayName) =>
				sendParentLinkedStudentEmail({
					to,
					recipientUserId: input.studentId,
					studentName: displayName,
					parentName,
				}),
		});
	} catch (err) {
		logServerError("notifications.parent_linked", err, {
			studentId: input.studentId,
			parentId: input.parentId,
		});
	}
}

/**
 * Parent portal: confirms which student account was linked to this parent login.
 */
export async function notifyParentChildLinkConfirmed(input: NotifyParentLinkedInput): Promise<void> {
	try {
		const contact = await loadProfileContact(input.studentId);
		const label = formatPersonDisplayName(contact?.fullName ?? "") || "your student";
		const prefs = await getNotificationPrefs(input.parentId);
		// Symmetry with `notifyParentLinkedToStudent`: parent-side link is a
		// trust signal; force the in-app row even if the parent muted system
		// notifications. Email still respects the per-type opt-out below.
		const notificationId = await insertInAppNotification({
			recipientId: input.parentId,
			senderId: input.studentId,
			title: `Connected to ${label}`,
			body: `You are now linked in EduAI as a parent for ${label}. Open Overview or Test reports to follow their progress (switch children from your account menu when you have more than one).`,
			type: "system",
			category: "parent_child_link_confirmed",
			referenceType: "student",
			referenceId: input.studentId,
			contextStudentId: input.studentId,
			forceInApp: true,
		});

		if (!isEmailAllowed(prefs, "system")) return;

		const parentContact = await loadProfileContact(input.parentId);
		if (!parentContact?.email) return;

		const parentDisplayName = formatPersonDisplayName(parentContact.fullName ?? "") || null;
		const { error } = await sendParentChildLinkConfirmedEmail({
			to: parentContact.email,
			recipientUserId: input.parentId,
			parentDisplayName,
			childDisplayName: label,
			studentId: input.studentId,
		});
		if (error) {
			logServerError("notifications.parent_child_link_confirmed.email", new Error(error), {
				studentId: input.studentId,
				parentId: input.parentId,
			});
			return;
		}
		if (notificationId) {
			await markNotificationEmailSent(notificationId);
		}
	} catch (err) {
		logServerError("notifications.parent_child_link_confirmed", err, {
			studentId: input.studentId,
			parentId: input.parentId,
		});
	}
}
