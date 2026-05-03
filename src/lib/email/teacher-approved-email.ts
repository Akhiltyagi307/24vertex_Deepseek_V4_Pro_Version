import "server-only";

import { getAppUrl } from "@/lib/env";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";

export async function sendTeacherApprovedEmail(to: string, teacherName: string): Promise<{ ok: boolean; error?: string }> {
	const appUrl = getAppUrl();
	const html = `
<p>Hi ${escapeHtml(teacherName)},</p>
<p>Your EduAI teacher account has been approved. You can sign in at <a href="${appUrl}/login">${escapeHtml(appUrl)}/login</a>.</p>
<p>— EduAI</p>`;
	const { error } = await sendHtmlEmailLogged({
		to,
		subject: "Your teacher account is approved",
		html,
		templateSlug: "teacher-approved",
		templateVariables: { teacher_name: teacherName },
	});
	if (error) return { ok: false, error };
	return { ok: true };
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
