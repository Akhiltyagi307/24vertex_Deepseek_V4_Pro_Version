import "server-only";

import { getAppUrl } from "@/lib/env";
import { escapeHtml, renderEmailShell } from "@/lib/email/render-email-shell";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";

function pctLabel(overall: number | null | undefined): string | null {
	return overall != null && Number.isFinite(overall) ? `${Math.round(overall)}%` : null;
}

function buildReportDedupKey(scope: "student" | "parent", testId: string, recipientId: string): string {
	return `report-ready:${testId}:${scope}:${recipientId}`;
}

export type ReportReadyEmailParams = {
	to: string;
	recipientUserId?: string | null;
	studentName?: string;
	subjectName: string;
	overallPercent: number | null;
	testId: string;
	/** UTC submission label (matches in-app bell), e.g. `12 May 2026`. */
	submittedLabel?: string | null;
	/** Supabase storage signed URL; opens PDF without 24Vertex login. */
	pdfSignedUrl?: string | null;
};

export async function sendReportReadyEmail(params: ReportReadyEmailParams): Promise<{ error: string | null }> {
	const pct = pctLabel(params.overallPercent);
	const dateChunk = params.submittedLabel ? ` (${params.submittedLabel})` : "";
	const subject = `Your ${params.subjectName} report is ready${dateChunk}`;
	const portalHref = `${getAppUrl()}/student/reports?test=${encodeURIComponent(params.testId)}`;
	const pdfUrl = params.pdfSignedUrl?.trim() || null;

	const subjectName = escapeHtml(params.subjectName);
	const studentName = escapeHtml(params.studentName ?? "there");

	const paragraphs: string[] = [];
	paragraphs.push(
		`We just finished grading your <strong>${subjectName}</strong> practice test${pct ? `. You scored <strong>${pct}</strong>.` : "."}`,
	);
	if (pdfUrl) {
		paragraphs.push(
			"Open the PDF for the full printable report. You don't need to sign in to 24Vertex to use this link, and it stays valid for 90 days.",
		);
		paragraphs.push("For topic breakdowns and your next recommended practice inside the app, use <em>View in 24Vertex</em>.");
	} else {
		paragraphs.push(
			"Open the report to see topic-level strengths, weaknesses, and your next recommended practice.",
		);
	}

	const html = renderEmailShell({
		preheader:
			pct ?
				`${pct} on your ${params.subjectName} report${dateChunk}. Open it now.`
			:	`Your ${params.subjectName} report is ready${dateChunk}.`,
		greeting: `Hi ${studentName},`,
		title: subject,
		paragraphs,
		primaryCta: pdfUrl
			? { label: "Open PDF report", href: pdfUrl }
			: { label: "View report", href: portalHref },
		secondaryCta: pdfUrl ? { label: "View in 24Vertex", href: portalHref } : undefined,
	});

	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		unsubscribeRecipientUserId: params.recipientUserId ?? null,
		subject,
		html,
		templateSlug: "report-ready",
		dedupKey: params.recipientUserId
			? buildReportDedupKey("student", params.testId, params.recipientUserId)
			: undefined,
		templateVariables: {
			student_name: params.studentName ?? "there",
			subject_name: params.subjectName,
			overall_percent: pct ?? "",
			test_id: params.testId,
			submitted_label: params.submittedLabel ?? "",
			report_href: portalHref,
			pdf_href: pdfUrl ?? "",
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
	submittedLabel?: string | null;
	pdfSignedUrl?: string | null;
};

/** Email to a linked parent when their child's practice test report is ready. */
export async function sendParentPortalReportReadyEmail(
	params: ParentPortalReportReadyEmailParams,
): Promise<{ error: string | null }> {
	const pct = pctLabel(params.overallPercent);
	const dateChunk = params.submittedLabel ? ` (${params.submittedLabel})` : "";
	const subject = `${params.childDisplayName}: ${params.subjectName} report ready${dateChunk}`;
	const portalHref = `${getAppUrl()}/parent/open-report?student=${encodeURIComponent(params.studentId)}&test=${encodeURIComponent(params.testId)}`;
	const pdfUrl = params.pdfSignedUrl?.trim() || null;

	const childName = escapeHtml(params.childDisplayName);
	const subjectName = escapeHtml(params.subjectName);
	const parentName = escapeHtml(params.parentDisplayName ?? "there");

	const paragraphs: string[] = [];
	paragraphs.push(
		`We just finished grading <strong>${childName}</strong>'s ${subjectName} practice test${pct ? `. They scored <strong>${pct}</strong>.` : "."}`,
	);
	if (pdfUrl) {
		paragraphs.push(
			"Open the PDF for the full printable report. You don't need to sign in to 24Vertex to use this link, and it stays valid for 90 days.",
		);
		paragraphs.push("For the interactive parent portal version, use <em>Open parent portal</em>.");
	} else {
		paragraphs.push("Open the parent portal report for topic strengths, gaps, and suggested next practice.");
	}

	const html = renderEmailShell({
		preheader:
			pct ?
				`${params.childDisplayName} scored ${pct} on ${params.subjectName}${dateChunk}.`
			:	`${params.childDisplayName}'s ${params.subjectName} report is ready${dateChunk}.`,
		greeting: `Hi ${parentName},`,
		title: subject,
		paragraphs,
		primaryCta: pdfUrl
			? { label: "Open PDF report", href: pdfUrl }
			: { label: "View report", href: portalHref },
		secondaryCta: pdfUrl ? { label: "Open parent portal", href: portalHref } : undefined,
		preferencesHref: `${getAppUrl()}/parent/settings#notifications`,
	});

	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		unsubscribeRecipientUserId: params.recipientUserId ?? null,
		subject,
		html,
		templateSlug: "parent-portal-report-ready",
		dedupKey: params.recipientUserId
			? buildReportDedupKey("parent", params.testId, params.recipientUserId)
			: undefined,
		templateVariables: {
			parent_name: params.parentDisplayName ?? "there",
			child_name: params.childDisplayName,
			subject_name: params.subjectName,
			overall_percent: pct ?? "",
			student_id: params.studentId,
			test_id: params.testId,
			submitted_label: params.submittedLabel ?? "",
			report_href: portalHref,
			pdf_href: pdfUrl ?? "",
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
	const subject = `Connected to ${params.childDisplayName} on 24Vertex`;
	const href = `${getAppUrl()}/parent/dashboard`;
	const childName = escapeHtml(params.childDisplayName);
	const parentName = escapeHtml(params.parentDisplayName ?? "there");

	const html = renderEmailShell({
		preheader: `You're now linked to ${params.childDisplayName} in 24Vertex.`,
		greeting: `Hi ${parentName},`,
		title: subject,
		paragraphs: [
			`Your parent account is now linked to <strong>${childName}</strong> in 24Vertex.`,
			"Open the parent portal to follow their progress, view test reports, and switch between children if you have more than one.",
		],
		primaryCta: { label: "Open parent portal", href },
		preferencesHref: `${getAppUrl()}/parent/settings#notifications`,
	});

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
		? `${params.childDisplayName}'s plan: 100% of ${label} used`
		: `${params.childDisplayName}'s plan: 80% of ${label} used`;
	const href = `${getAppUrl()}/parent/subscription`;

	const childName = escapeHtml(params.childDisplayName);
	const parentName = escapeHtml(params.parentDisplayName ?? "there");

	const usedNum = isTests ? params.testsUsed ?? 0 : params.tokensUsed ?? 0;
	const quotaNum = isTests ? params.testsQuota ?? 0 : params.tokensQuota ?? 0;
	const usedFmt = isTests ? String(usedNum) : usedNum.toLocaleString();
	const quotaFmt = isTests ? String(quotaNum) : quotaNum.toLocaleString();

	const paragraphs = [
		hundred
			? `<strong>${childName}</strong> has reached the limit for ${label} on their current plan period.`
			: `<strong>${childName}</strong> is approaching the limit for ${label} on their current plan period.`,
		hundred
			? "Upgrade or top up in the parent portal so their practice doesn't pause."
			: "You may want to review their plan soon so practice doesn't pause at 100%.",
	];

	const html = renderEmailShell({
		preheader: `${params.childDisplayName}: ${params.threshold}% of ${label} used this period.`,
		greeting: `Hi ${parentName},`,
		title: subject,
		paragraphs,
		stats: [
			{ label: isTests ? "Tests used" : "Tokens used", value: `${usedFmt} of ${quotaFmt}` },
			{ label: "Threshold", value: `${params.threshold}%` },
		],
		callout: hundred
			? { tone: "warning", text: "Practice is paused until quota resets or the plan is upgraded." }
			: undefined,
		primaryCta: { label: hundred ? "Upgrade plan" : "View plan", href },
		preferencesHref: `${getAppUrl()}/parent/settings#notifications`,
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
		unsubscribeRecipientUserId: params.recipientUserId ?? null,
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
	const studentName = escapeHtml(params.studentName ?? "there");

	const usedNum = isTests ? params.testsUsed ?? 0 : params.tokensUsed ?? 0;
	const quotaNum = isTests ? params.testsQuota ?? 0 : params.tokensQuota ?? 0;
	const usedFmt = isTests ? String(usedNum) : usedNum.toLocaleString();
	const quotaFmt = isTests ? String(quotaNum) : quotaNum.toLocaleString();

	const paragraphs = [
		hundred
			? `You've reached the limit of your plan's ${label} for this billing period.`
			: `You're approaching the limit of your plan's ${label} for this billing period.`,
		hundred
			? "Upgrade or top up to keep practicing without a pause."
			: "Consider upgrading soon so your practice doesn't pause when you hit 100%.",
	];

	const html = renderEmailShell({
		preheader: `${params.threshold}% of ${label} used this period.`,
		greeting: `Hi ${studentName},`,
		title: subject,
		paragraphs,
		stats: [
			{ label: isTests ? "Tests used" : "Tokens used", value: `${usedFmt} of ${quotaFmt}` },
			{ label: "Threshold", value: `${params.threshold}%` },
		],
		callout: hundred
			? { tone: "warning", text: "Practice is paused until your quota resets or you upgrade." }
			: undefined,
		primaryCta: { label: hundred ? "Upgrade plan" : "View plan", href },
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
		unsubscribeRecipientUserId: params.recipientUserId ?? null,
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
	const subject = "Your 24Vertex password was changed";
	const href = `${getAppUrl()}/student/settings`;
	const displayName = escapeHtml(params.displayName?.trim() || "there");

	const html = renderEmailShell({
		preheader: "Confirming a password change on your 24Vertex account.",
		greeting: `Hi ${displayName},`,
		title: subject,
		paragraphs: [
			"This confirms the password for your 24Vertex account was just changed.",
			"If you did not make this change, reset your password from Account settings or contact support right away.",
		],
		callout: { tone: "info", text: "We'll always email you when something important changes on your account." },
		primaryCta: { label: "Account settings", href },
	});

	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		subject,
		html,
		templateSlug: "account-password-changed",
		templateVariables: {
			display_name: params.displayName?.trim() || "there",
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
	const subject = "Your 24Vertex sign-in email was updated";
	const href = `${getAppUrl()}/student/settings`;
	const displayName = escapeHtml(params.displayName?.trim() || "there");
	const newEmail = params.newEmail?.trim() ?? "";

	const paragraphs = ["The email address you use to sign in to 24Vertex was updated."];
	if (newEmail) {
		paragraphs.push(`New address: <strong>${escapeHtml(newEmail)}</strong>.`);
	}
	paragraphs.push("If you did not request this, contact support immediately.");

	const html = renderEmailShell({
		preheader: "Confirming a sign-in email change on your 24Vertex account.",
		greeting: `Hi ${displayName},`,
		title: subject,
		paragraphs,
		primaryCta: { label: "Account settings", href },
	});

	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		subject,
		html,
		templateSlug: "account-email-changed",
		templateVariables: {
			display_name: params.displayName?.trim() || "there",
			new_email: newEmail,
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
	const subject = "A parent account was linked to your 24Vertex profile";
	const href = `${getAppUrl()}/student/settings`;
	const displayName = escapeHtml(params.studentName?.trim() || "there");
	const parentLine = params.parentName?.trim()
		? `Parent or guardian: <strong>${escapeHtml(params.parentName.trim())}</strong>.`
		: "A parent or guardian account is now linked.";

	const html = renderEmailShell({
		preheader: "Heads up: a parent account is now linked to your 24Vertex profile.",
		greeting: `Hi ${displayName},`,
		title: subject,
		paragraphs: [
			parentLine,
			"They can use the parent portal for updates you share with them. If something looks off, open Account settings.",
		],
		primaryCta: { label: "Account settings", href },
	});

	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		subject,
		html,
		templateSlug: "parent-linked-student",
		templateVariables: {
			student_name: params.studentName?.trim() || "there",
			parent_name: params.parentName?.trim() ?? "",
			settings_href: href,
		},
	});
}
