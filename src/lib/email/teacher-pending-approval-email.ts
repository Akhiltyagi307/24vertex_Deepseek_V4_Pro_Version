import "server-only";

import { escapeHtml, renderEmailShell } from "@/lib/email/render-email-shell";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";

/**
 * Sent when a teacher completes signup (profile created, awaiting admin verification).
 * Idempotent per user via {@link sendHtmlEmailLogged} `dedupKey`.
 */
export async function sendTeacherPendingApprovalEmail(
	to: string,
	teacherName: string,
	options?: { dedupKey?: string },
): Promise<{ ok: boolean; error?: string }> {
	const subject = "We received your EduAI teacher signup";
	const safeName = escapeHtml(teacherName);

	const html = renderEmailShell({
		preheader: "The 24vertex team will review your account shortly.",
		greeting: `Hi ${safeName},`,
		title: subject,
		paragraphs: [
			"Thanks for signing up as a teacher on EduAI.",
			"The 24vertex team will review and approve your account within 24–48 hours. We’ll email you again when you can sign in and use the full teacher workspace.",
			"If you have questions, reply to this email or contact your school administrator.",
		],
	});

	const { error } = await sendHtmlEmailLogged({
		to,
		subject,
		html,
		templateSlug: "teacher-pending-approval",
		templateVariables: { teacher_name: teacherName },
		dedupKey: options?.dedupKey,
	});

	if (error) return { ok: false, error };
	return { ok: true };
}
