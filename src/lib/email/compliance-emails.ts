import "server-only";

import { getAppUrl } from "@/lib/env";
import { escapeHtml, renderEmailShell } from "@/lib/email/render-email-shell";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";

export async function sendParentalConsentRerequestEmail(params: {
	to: string;
	studentName: string;
	studentId: string;
}): Promise<{ error: string | null }> {
	const subject = "Action needed: parental consent for EduAI";
	const safeName = escapeHtml(params.studentName);
	const parentHref = `${getAppUrl()}/parent`;

	const html = renderEmailShell({
		preheader: `We need renewed parental consent for ${params.studentName}.`,
		greeting: "Hello,",
		title: subject,
		paragraphs: [
			`We need renewed parental consent for the EduAI student account belonging to <strong>${safeName}</strong>.`,
			"Please review and complete consent using your usual parent account flow.",
			"If you did not expect this message, contact support.",
		],
		primaryCta: { label: "Open parent portal", href: parentHref },
	});

	return sendHtmlEmailLogged({
		to: params.to,
		subject,
		html,
		templateSlug: "parental-consent-rerequest",
		templateVariables: {
			student_name: params.studentName,
			student_id: params.studentId,
		},
	});
}

export async function sendComplianceDsrFulfilledEmail(params: {
	to: string;
	requestType: string;
}): Promise<{ error: string | null }> {
	const subject = "Your EduAI privacy request update";
	const safeType = escapeHtml(params.requestType);

	const html = renderEmailShell({
		preheader: `Your ${params.requestType} request has been fulfilled.`,
		greeting: "Hello,",
		title: subject,
		paragraphs: [
			`Your data subject request (<strong>${safeType}</strong>) for EduAI has been marked fulfilled by our team.`,
			"If you need further assistance, reply to this email.",
		],
	});

	return sendHtmlEmailLogged({
		to: params.to,
		subject,
		html,
		templateSlug: "compliance-dsr-fulfilled",
		templateVariables: { request_type: params.requestType },
	});
}
