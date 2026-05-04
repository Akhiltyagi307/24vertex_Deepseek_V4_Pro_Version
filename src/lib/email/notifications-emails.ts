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

function wrapHtml(title: string, bodyLines: string[], cta?: { label: string; href: string }): string {
	const lines = bodyLines.map((line) => `<p style="margin:0 0 12px;">${line}</p>`).join("");
	const button = cta
		? `<p style="margin:24px 0;"><a href="${escapeHtml(cta.href)}" style="background:#059669;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">${escapeHtml(cta.label)}</a></p>`
		: "";
	return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui,sans-serif;line-height:1.55;color:#111;max-width:560px;margin:0 auto;padding:24px;">
<h1 style="font-size:20px;margin:0 0 16px;">${escapeHtml(title)}</h1>
${lines}
${button}
<p style="margin:16px 0 0;font-size:13px;color:#666;">${escapeHtml(getAppUrl())}</p>
</body></html>`;
}

export type ReportReadyEmailParams = {
	to: string;
	recipientUserId?: string | null;
	studentName?: string;
	subjectName: string;
	overallPercent: number | null;
	testId: string;
};

export async function sendReportReadyEmail(params: ReportReadyEmailParams): Promise<{ error: string | null }> {
	const pct =
		params.overallPercent != null && Number.isFinite(params.overallPercent)
			? `${Math.round(params.overallPercent)}%`
			: null;
	const subject = `Your ${params.subjectName} report is ready`;
	const href = `${getAppUrl()}/student/reports?test=${encodeURIComponent(params.testId)}`;
	const bodyLines = [
		`Hi ${escapeHtml(params.studentName ?? "there")},`,
		`We just graded your ${escapeHtml(params.subjectName)} practice test${pct ? ` — you scored ${pct}.` : "."}`,
		"Open the report to see topic-level strengths, weaknesses, and your next recommended practice.",
	];
	const html = wrapHtml(subject, bodyLines, { label: "View report", href });
	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		subject,
		html,
		templateSlug: "report-ready",
		templateVariables: {
			student_name: params.studentName ?? "there",
			subject_name: params.subjectName,
			overall_percent: pct ?? "",
			test_id: params.testId,
			report_href: href,
		},
	});
}

export type ParentPortalReportReadyEmailParams = {
	to: string;
	recipientUserId?: string | null;
	parentDisplayName?: string | null;
	childDisplayName: string;
	studentId: string;
	subjectName: string;
	overallPercent: number | null;
	testId: string;
};

/** Email to a linked parent when their child's practice test report is ready. */
export async function sendParentPortalReportReadyEmail(
	params: ParentPortalReportReadyEmailParams,
): Promise<{ error: string | null }> {
	const pct =
		params.overallPercent != null && Number.isFinite(params.overallPercent)
			? `${Math.round(params.overallPercent)}%`
			: null;
	const subject = `${params.childDisplayName} — ${params.subjectName} report ready`;
	const href = `${getAppUrl()}/parent/open-report?student=${encodeURIComponent(params.studentId)}&test=${encodeURIComponent(params.testId)}`;
	const bodyLines = [
		`Hi ${escapeHtml(params.parentDisplayName ?? "there")},`,
		`We just finished grading ${escapeHtml(params.childDisplayName)}'s ${escapeHtml(params.subjectName)} practice test${pct ? ` — they scored ${pct}.` : "."}`,
		"Open the parent portal report for topic strengths, gaps, and suggested next practice.",
	];
	const html = wrapHtml(subject, bodyLines, { label: "View report", href });
	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		subject,
		html,
		templateSlug: "parent-portal-report-ready",
		templateVariables: {
			parent_name: params.parentDisplayName ?? "there",
			child_name: params.childDisplayName,
			subject_name: params.subjectName,
			overall_percent: pct ?? "",
			student_id: params.studentId,
			test_id: params.testId,
			report_href: href,
		},
	});
}

export type ParentChildLinkConfirmedEmailParams = {
	to: string;
	recipientUserId?: string | null;
	parentDisplayName?: string | null;
	childDisplayName: string;
	studentId: string;
};

/** Email to the parent right after their account is linked to a student. */
export async function sendParentChildLinkConfirmedEmail(
	params: ParentChildLinkConfirmedEmailParams,
): Promise<{ error: string | null }> {
	const subject = `Connected to ${params.childDisplayName} on EduAI`;
	const href = `${getAppUrl()}/parent/dashboard`;
	const bodyLines = [
		`Hi ${escapeHtml(params.parentDisplayName ?? "there")},`,
		`Your parent login is now linked to ${escapeHtml(params.childDisplayName)} in EduAI.`,
		"You can open the parent portal to follow their progress, view test reports, and more.",
	];
	const html = wrapHtml(subject, bodyLines, { label: "Open parent portal", href });
	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		subject,
		html,
		templateSlug: "parent-child-link-confirmed",
		templateVariables: {
			parent_name: params.parentDisplayName ?? "there",
			child_name: params.childDisplayName,
			student_id: params.studentId,
			dashboard_href: href,
		},
	});
}

export type ParentPortalUsageThresholdEmailParams = {
	to: string;
	recipientUserId?: string | null;
	parentDisplayName?: string | null;
	childDisplayName: string;
	meter: "tests" | "tokens";
	threshold: 80 | 100;
	testsUsed?: number;
	testsQuota?: number;
	tokensUsed?: number;
	tokensQuota?: number;
};

/** Email to linked parents when the child's plan usage crosses 80% or 100%. */
export async function sendParentPortalUsageThresholdEmail(
	params: ParentPortalUsageThresholdEmailParams,
): Promise<{ error: string | null }> {
	const isTests = params.meter === "tests";
	const label = isTests ? "practice tests" : "doubt-chat tokens";
	const hundred = params.threshold === 100;
	const subject = hundred
		? `${params.childDisplayName}'s plan — 100% of ${label} this period`
		: `${params.childDisplayName}'s plan — 80% of ${label} this period`;
	const href = `${getAppUrl()}/parent/subscription`;
	const statLine = isTests
		? `${params.testsUsed ?? 0} of ${params.testsQuota ?? 0} tests used this period.`
		: `${(params.tokensUsed ?? 0).toLocaleString()} of ${(params.tokensQuota ?? 0).toLocaleString()} tokens used this period.`;
	const bodyLines = [
		`Hi ${escapeHtml(params.parentDisplayName ?? "there")},`,
		hundred
			? `${escapeHtml(params.childDisplayName)} has reached the limit for ${label} on their current plan period.`
			: `${escapeHtml(params.childDisplayName)} is approaching the limit for ${label} on their current plan period.`,
		escapeHtml(statLine),
		hundred
			? "Open Plan & billing in the parent portal to upgrade or top up so their practice can continue without pausing."
			: "You may want to review their plan soon so practice doesn't pause at 100%.",
	];
	const html = wrapHtml(subject, bodyLines, {
		label: hundred ? "Upgrade plan" : "View plan",
		href,
	});
	const slug = isTests
		? params.threshold === 80
			? "parent-usage-tests-80"
			: "parent-usage-tests-100"
		: params.threshold === 80
			? "parent-usage-tokens-80"
			: "parent-usage-tokens-100";
	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		subject,
		html,
		templateSlug: slug,
		templateVariables: {
			parent_name: params.parentDisplayName ?? "there",
			child_name: params.childDisplayName,
			meter: params.meter,
			threshold: String(params.threshold),
			tests_used: String(params.testsUsed ?? ""),
			tests_quota: String(params.testsQuota ?? ""),
			tokens_used: String(params.tokensUsed ?? ""),
			tokens_quota: String(params.tokensQuota ?? ""),
			plan_href: href,
		},
	});
}

export type UsageThresholdEmailParams = {
	to: string;
	recipientUserId?: string | null;
	studentName?: string;
	meter: "tests" | "tokens";
	threshold: 80 | 100;
	testsUsed?: number;
	testsQuota?: number;
	tokensUsed?: number;
	tokensQuota?: number;
};

export async function sendUsageThresholdEmail(
	params: UsageThresholdEmailParams,
): Promise<{ error: string | null }> {
	const isTests = params.meter === "tests";
	const label = isTests ? "practice tests" : "doubt-chat tokens";
	const hundred = params.threshold === 100;
	const subject = hundred
		? `You've used 100% of your ${label} this period`
		: `You've used 80% of your ${label} this period`;
	const href = `${getAppUrl()}/student/subscription`;
	const statLine = isTests
		? `${params.testsUsed ?? 0} of ${params.testsQuota ?? 0} tests used.`
		: `${(params.tokensUsed ?? 0).toLocaleString()} of ${(params.tokensQuota ?? 0).toLocaleString()} tokens used.`;
	const bodyLines = [
		`Hi ${escapeHtml(params.studentName ?? "there")},`,
		hundred
			? `You've reached the limit of your plan's ${label} for the current period.`
			: `You're approaching the limit of your plan's ${label} for the current period.`,
		escapeHtml(statLine),
		hundred
			? "Upgrade or top up to continue without pausing your practice."
			: "Consider upgrading soon so your practice doesn't pause when you hit 100%.",
	];
	const html = wrapHtml(subject, bodyLines, {
		label: hundred ? "Upgrade plan" : "View plan",
		href,
	});
	const slug = isTests
		? params.threshold === 80
			? "usage-tests-80"
			: "usage-tests-100"
		: params.threshold === 80
			? "usage-tokens-80"
			: "usage-tokens-100";
	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		subject,
		html,
		templateSlug: slug,
		templateVariables: {
			student_name: params.studentName ?? "there",
			meter: params.meter,
			threshold: String(params.threshold),
			tests_used: String(params.testsUsed ?? ""),
			tests_quota: String(params.testsQuota ?? ""),
			tokens_used: String(params.tokensUsed ?? ""),
			tokens_quota: String(params.tokensQuota ?? ""),
			plan_href: href,
		},
	});
}

export type AccountSecurityEmailParams = {
	to: string;
	recipientUserId?: string | null;
	displayName?: string | null;
};

export async function sendAccountPasswordChangedEmail(
	params: AccountSecurityEmailParams,
): Promise<{ error: string | null }> {
	const subject = "Your EduAI password was changed";
	const href = `${getAppUrl()}/student/settings`;
	const bodyLines = [
		`Hi ${escapeHtml(params.displayName ?? "there")},`,
		"This confirms the password for your EduAI account was just changed.",
		"If you did not make this change, reset your password from Account settings or contact support right away.",
	];
	const html = wrapHtml(subject, bodyLines, { label: "Account settings", href });
	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		subject,
		html,
		templateSlug: "account-password-changed",
		templateVariables: {
			display_name: params.displayName ?? "there",
			settings_href: href,
		},
	});
}

export type AccountEmailChangedParams = AccountSecurityEmailParams & {
	newEmail?: string | null;
};

export async function sendAccountEmailChangedEmail(
	params: AccountEmailChangedParams,
): Promise<{ error: string | null }> {
	const subject = "Your EduAI sign-in email was updated";
	const href = `${getAppUrl()}/student/settings`;
	const lines = [
		`Hi ${escapeHtml(params.displayName ?? "there")},`,
		"The email address you use to sign in to EduAI was updated.",
	];
	if (params.newEmail?.trim()) {
		lines.push(`New address: ${escapeHtml(params.newEmail.trim())}.`);
	}
	lines.push("If you did not request this, contact support immediately.");
	const html = wrapHtml(subject, lines, { label: "Account settings", href });
	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		subject,
		html,
		templateSlug: "account-email-changed",
		templateVariables: {
			display_name: params.displayName ?? "there",
			new_email: params.newEmail?.trim() ?? "",
			settings_href: href,
		},
	});
}

export type ParentLinkedStudentEmailParams = {
	to: string;
	recipientUserId?: string | null;
	studentName?: string | null;
	parentName?: string | null;
};

export async function sendParentLinkedStudentEmail(
	params: ParentLinkedStudentEmailParams,
): Promise<{ error: string | null }> {
	const subject = "A parent account was linked to your EduAI profile";
	const href = `${getAppUrl()}/student/settings`;
	const who = params.parentName?.trim()
		? `Parent/guardian: ${escapeHtml(params.parentName.trim())}.`
		: "A parent or guardian account is now linked.";
	const bodyLines = [
		`Hi ${escapeHtml(params.studentName ?? "there")},`,
		who,
		"They can use the parent portal for updates you share with them. Open Account settings if you need help.",
	];
	const html = wrapHtml(subject, bodyLines, { label: "Account settings", href });
	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		subject,
		html,
		templateSlug: "parent-linked-student",
		templateVariables: {
			student_name: params.studentName ?? "there",
			parent_name: params.parentName?.trim() ?? "",
			settings_href: href,
		},
	});
}
