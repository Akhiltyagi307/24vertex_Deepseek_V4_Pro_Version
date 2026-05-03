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

type CommonParams = { to: string; studentName?: string };

export type TrialEndingParams = CommonParams & { daysLeft: number };
export async function sendTrialEndingEmail(params: TrialEndingParams): Promise<{ error: string | null }> {
	const subject =
		params.daysLeft <= 0
			? "Your EduAI trial ends today"
			: `Only ${params.daysLeft} day${params.daysLeft === 1 ? "" : "s"} left on your EduAI trial`;
	const html = wrapHtml(
		subject,
		[
			`Hi ${escapeHtml(params.studentName ?? "there")},`,
			"Your 14-day free trial is wrapping up. Add a payment method now so your practice doesn't pause — you won't be charged until the trial actually ends.",
			"Switch to Pro Monthly (₹1,000/month) or Pro Annual (₹10,000/year — ~17% off) in one tap.",
		],
		{ label: "Continue with Pro", href: `${getAppUrl()}/student/subscription` },
	);
	return sendHtmlEmailLogged({
		to: params.to,
		subject,
		html,
		templateSlug: "trial-ending",
		templateVariables: {
			student_name: params.studentName ?? "there",
			days_left: String(params.daysLeft),
		},
	});
}

export type PaymentReceiptParams = CommonParams & {
	amountLabel: string;
	planName?: string;
	invoiceShortUrl?: string | null;
	paymentRef?: string | null;
};

/** Sent after a successful charge (webhook). Includes hosted invoice link when available. */
export async function sendPaymentReceiptEmail(params: PaymentReceiptParams): Promise<{ error: string | null }> {
	const subject = "Payment received — EduAI";
	const planLine = params.planName
		? `Plan: <strong>${escapeHtml(params.planName)}</strong>.`
		: "Thank you for your payment.";
	const refLine = params.paymentRef
		? `Reference: <code style="font-size:13px;">${escapeHtml(params.paymentRef)}</code>`
		: null;
	const bodyLines = [
		`Hi ${escapeHtml(params.studentName ?? "there")},`,
		`We received <strong>${escapeHtml(params.amountLabel)}</strong> for your EduAI subscription.`,
		planLine,
		...(refLine ? [refLine] : []),
		params.invoiceShortUrl
			? "Your Razorpay invoice is available at the link below."
			: "You can review payment history anytime in your subscription settings.",
	];
	const primaryCta = params.invoiceShortUrl
		? { label: "View invoice", href: params.invoiceShortUrl }
		: { label: "Payment history", href: `${getAppUrl()}/student/subscription` };
	const html = wrapHtml(subject, bodyLines, primaryCta);
	return sendHtmlEmailLogged({
		to: params.to,
		subject,
		html,
		templateSlug: "payment-receipt",
		templateVariables: {
			student_name: params.studentName ?? "there",
			amount_label: params.amountLabel,
			plan_name: params.planName ?? "",
		},
	});
}

export type SubscriptionActiveParams = CommonParams & { planName: string; nextRenewalIso: string };
export async function sendSubscriptionActiveEmail(params: SubscriptionActiveParams): Promise<{ error: string | null }> {
	const subject = `Welcome to ${params.planName}!`;
	const renewal = new Date(params.nextRenewalIso).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
	const html = wrapHtml(
		subject,
		[
			`Hi ${escapeHtml(params.studentName ?? "there")},`,
			`Your ${escapeHtml(params.planName)} subscription is now active. Next renewal: <strong>${escapeHtml(renewal)}</strong>.`,
			"Enjoy unlimited practice and the expanded AI output allowance for doubt chat!",
		],
		{ label: "Open EduAI", href: `${getAppUrl()}/student/dashboard` },
	);
	return sendHtmlEmailLogged({
		to: params.to,
		subject,
		html,
		templateSlug: "subscription-active",
		templateVariables: {
			student_name: params.studentName ?? "there",
			plan_name: params.planName,
			next_renewal: renewal,
		},
	});
}

export type PaymentFailedParams = CommonParams;
export async function sendPaymentFailedEmail(params: PaymentFailedParams): Promise<{ error: string | null }> {
	const subject = "We couldn't collect your EduAI payment";
	const html = wrapHtml(
		subject,
		[
			`Hi ${escapeHtml(params.studentName ?? "there")},`,
			"We tried to charge your payment method for your EduAI subscription but it was declined. Razorpay will retry automatically.",
			"To avoid an interruption, please check your UPI/card mandate status or update your payment method.",
		],
		{ label: "Fix payment method", href: `${getAppUrl()}/student/subscription` },
	);
	return sendHtmlEmailLogged({
		to: params.to,
		subject,
		html,
		templateSlug: "subscription-payment-failed",
		templateVariables: { student_name: params.studentName ?? "there" },
	});
}

export type UsageNearLimitParams = CommonParams & {
	resource: "tests" | "tokens";
	percentUsed: number;
};
export async function sendUsageNearLimitEmail(params: UsageNearLimitParams): Promise<{ error: string | null }> {
	const resourceLabel = params.resource === "tests" ? "practice tests" : "AI output tokens (doubt chat)";
	const subject = `You've used ${params.percentUsed}% of your ${resourceLabel} this period`;
	const html = wrapHtml(
		subject,
		[
			`Hi ${escapeHtml(params.studentName ?? "there")},`,
			`You're at <strong>${params.percentUsed}%</strong> of your included ${escapeHtml(resourceLabel)} for the current billing period.`,
			"Upgrade to Pro Annual for 12× the monthly allowance, or sit tight — your quota resets automatically at the next renewal.",
		],
		{ label: "Review your plan", href: `${getAppUrl()}/student/subscription` },
	);
	return sendHtmlEmailLogged({
		to: params.to,
		subject,
		html,
		templateSlug: "usage-near-limit",
		templateVariables: {
			student_name: params.studentName ?? "there",
			percent_used: String(params.percentUsed),
			resource: params.resource,
		},
	});
}
