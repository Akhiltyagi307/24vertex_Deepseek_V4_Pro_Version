import "server-only";

import { getAppUrl } from "@/lib/env";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export async function sendParentalConsentRerequestEmail(params: {
	to: string;
	studentName: string;
	studentId: string;
}): Promise<{ error: string | null }> {
	const appUrl = getAppUrl();
	const html = `
<p>Hello,</p>
<p>We need renewed parental consent for a student account (${escapeHtml(params.studentName)}) on EduAI.</p>
<p>Please review and complete consent using your usual parent account flow: <a href="${appUrl}/parent">${escapeHtml(appUrl)}/parent</a>.</p>
<p>If you did not expect this message, contact support.</p>
<p>— EduAI</p>`;
	return sendHtmlEmailLogged({
		to: params.to,
		subject: "Action needed: parental consent for EduAI",
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
	const html = `
<p>Hello,</p>
<p>Your data subject request (${escapeHtml(params.requestType)}) for EduAI has been marked fulfilled by our team.</p>
<p>If you need further assistance, reply to this email.</p>
<p>— EduAI</p>`;
	return sendHtmlEmailLogged({
		to: params.to,
		subject: "Your EduAI privacy request update",
		html,
		templateSlug: "compliance-dsr-fulfilled",
		templateVariables: { request_type: params.requestType },
	});
}
