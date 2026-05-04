import { getAppUrl } from "@/lib/env";
import { escapeHtml, renderEmailShell } from "@/lib/email/render-email-shell";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";

function buildRemovalEmail(name: string): string {
	const safeName = escapeHtml(name);
	return renderEmailShell({
		preheader: `Your email was removed from ${name}'s EduAI guardian contact.`,
		greeting: "Hello,",
		title: "Guardian email removed from EduAI",
		paragraphs: [
			`The guardian or parent email on <strong>${safeName}</strong>'s EduAI profile was replaced with a different address.`,
			"If you did not expect this change, please contact your school or EduAI support.",
		],
		primaryCta: { label: "Open EduAI", href: getAppUrl() },
	});
}

function buildAdditionEmail(name: string): string {
	const safeName = escapeHtml(name);
	return renderEmailShell({
		preheader: `${name} added this address as their guardian contact on EduAI.`,
		greeting: "Hello,",
		title: "Guardian email added to EduAI",
		paragraphs: [
			`<strong>${safeName}</strong> listed this address as their guardian or parent contact on EduAI.`,
			"You may receive account-related messages about their learning progress.",
		],
		primaryCta: { label: "Open EduAI", href: getAppUrl() },
	});
}

export type ParentEmailChangeParams = {
	studentDisplayName: string;
	oldEmail: string;
	newEmail: string;
};

/**
 * Sends removal notice to the previous guardian email and addition notice to the new one.
 * Call only when `oldEmail` and `newEmail` differ (normalized).
 */
export async function sendParentEmailChangeNotifications(
	params: ParentEmailChangeParams,
): Promise<{ error: string | null }> {
	const name = params.studentDisplayName.trim() || "A student";

	const [removed, added] = await Promise.all([
		sendHtmlEmailLogged({
			to: params.oldEmail,
			subject: "Your email was removed from an EduAI student profile",
			html: buildRemovalEmail(name),
			templateSlug: "parent-email-removed",
			templateVariables: { student_name: name },
		}),
		sendHtmlEmailLogged({
			to: params.newEmail,
			subject: "You were added as a guardian on EduAI",
			html: buildAdditionEmail(name),
			templateSlug: "parent-invitation",
			templateVariables: { student_name: name },
		}),
	]);

	if (removed.error) return { error: removed.error };
	if (added.error) return { error: added.error };
	return { error: null };
}

export type ParentEmailAddedParams = {
	studentDisplayName: string;
	newEmail: string;
};

export async function sendParentEmailAddedNotification(
	params: ParentEmailAddedParams,
): Promise<{ error: string | null }> {
	const name = params.studentDisplayName.trim() || "A student";
	return sendHtmlEmailLogged({
		to: params.newEmail,
		subject: "You were added as a guardian on EduAI",
		html: buildAdditionEmail(name),
		templateSlug: "parent-invitation",
		templateVariables: { student_name: name },
	});
}

export type ParentEmailRemovedParams = {
	studentDisplayName: string;
	oldEmail: string;
};

export async function sendParentEmailRemovedNotification(
	params: ParentEmailRemovedParams,
): Promise<{ error: string | null }> {
	const name = params.studentDisplayName.trim() || "A student";
	return sendHtmlEmailLogged({
		to: params.oldEmail,
		subject: "Your email was removed from an EduAI student profile",
		html: buildRemovalEmail(name),
		templateSlug: "parent-email-removed",
		templateVariables: { student_name: name },
	});
}
