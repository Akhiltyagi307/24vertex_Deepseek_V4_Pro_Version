import { Resend } from "resend";

import { getAppUrl, getResendApiKey, getResendFrom } from "@/lib/env";

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function wrapHtml(title: string, bodyLines: string[]): string {
	const lines = bodyLines.map((line) => `<p style="margin:0 0 12px;">${line}</p>`).join("");
	return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;">
<h1 style="font-size:18px;margin:0 0 16px;">${escapeHtml(title)}</h1>
${lines}
<p style="margin:16px 0 0;font-size:13px;color:#666;">${escapeHtml(getAppUrl())}</p>
</body></html>`;
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
	const resend = new Resend(getResendApiKey());
	const from = getResendFrom();
	const name = params.studentDisplayName.trim() || "A student";

	const removalHtml = wrapHtml("Guardian email removed from EduAI", [
		`The guardian or parent email on <strong>${escapeHtml(name)}</strong>'s EduAI profile was replaced with a different address.`,
		"If you did not expect this change, contact your school or EduAI support.",
	]);

	const additionHtml = wrapHtml("Guardian email added to EduAI", [
		`<strong>${escapeHtml(name)}</strong> listed this address as their guardian or parent contact on EduAI.`,
		"You may receive account-related messages about their learning progress.",
	]);

	const [removed, added] = await Promise.all([
		resend.emails.send({
			from,
			to: params.oldEmail,
			subject: "Your email was removed from an EduAI student profile",
			html: removalHtml,
		}),
		resend.emails.send({
			from,
			to: params.newEmail,
			subject: "You were added as a guardian on EduAI",
			html: additionHtml,
		}),
	]);

	if (removed.error) {
		return { error: removed.error.message };
	}
	if (added.error) {
		return { error: added.error.message };
	}
	return { error: null };
}

export type ParentEmailAddedParams = {
	studentDisplayName: string;
	newEmail: string;
};

export async function sendParentEmailAddedNotification(
	params: ParentEmailAddedParams,
): Promise<{ error: string | null }> {
	const resend = new Resend(getResendApiKey());
	const from = getResendFrom();
	const name = params.studentDisplayName.trim() || "A student";
	const html = wrapHtml("Guardian email added to EduAI", [
		`<strong>${escapeHtml(name)}</strong> listed this address as their guardian or parent contact on EduAI.`,
		"You may receive account-related messages about their learning progress.",
	]);

	const { error } = await resend.emails.send({
		from,
		to: params.newEmail,
		subject: "You were added as a guardian on EduAI",
		html,
	});

	if (error) return { error: error.message };
	return { error: null };
}

export type ParentEmailRemovedParams = {
	studentDisplayName: string;
	oldEmail: string;
};

export async function sendParentEmailRemovedNotification(
	params: ParentEmailRemovedParams,
): Promise<{ error: string | null }> {
	const resend = new Resend(getResendApiKey());
	const from = getResendFrom();
	const name = params.studentDisplayName.trim() || "A student";
	const html = wrapHtml("Guardian email removed from EduAI", [
		`The guardian or parent email on <strong>${escapeHtml(name)}</strong>'s EduAI profile was cleared or replaced.`,
		"If you did not expect this change, contact your school or EduAI support.",
	]);

	const { error } = await resend.emails.send({
		from,
		to: params.oldEmail,
		subject: "Your email was removed from an EduAI student profile",
		html,
	});

	if (error) return { error: error.message };
	return { error: null };
}
