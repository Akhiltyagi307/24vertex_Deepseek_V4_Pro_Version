import "server-only";

import { getAppUrl } from "@/lib/env";
import { escapeHtml, renderEmailShell } from "@/lib/email/render-email-shell";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";

export async function sendTeacherApprovedEmail(
	to: string,
	teacherName: string,
): Promise<{ ok: boolean; error?: string }> {
	try {
		const subject = "Your teacher account is approved";
		const loginHref = `${getAppUrl()}/login/educator`;
		const safeName = escapeHtml(teacherName);

		const html = renderEmailShell({
			preheader: "Your EduAI teacher account is ready to sign in.",
			greeting: `Hi ${safeName},`,
			title: subject,
			paragraphs: ["Your EduAI teacher account has been approved. You can sign in below."],
			primaryCta: { label: "Sign in to EduAI", href: loginHref },
		});

		const { error } = await sendHtmlEmailLogged({
			to,
			subject,
			html,
			templateSlug: "teacher-approved",
			templateVariables: { teacher_name: teacherName },
		});

		if (error) return { ok: false, error };
		return { ok: true };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return { ok: false, error: msg };
	}
}
