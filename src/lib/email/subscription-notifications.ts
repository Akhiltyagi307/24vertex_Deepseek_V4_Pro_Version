import { getAppUrl } from "@/lib/env";
import { formatDateLongDMYInAppTimeZone } from "@/lib/datetime/app-timezone";
import { escapeHtml, renderEmailShell } from "@/lib/email/render-email-shell";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";

type CommonParams = {
	to: string;
	studentName?: string | null;
	recipientUserId?: string | null;
};

export type TrialEndingParams = CommonParams & { daysLeft: number };
export async function sendTrialEndingEmail(params: TrialEndingParams): Promise<{ error: string | null }> {
	const subject =
		params.daysLeft <= 0
			? "Your 24Vertex trial ends today"
			: `Only ${params.daysLeft} day${params.daysLeft === 1 ? "" : "s"} left on your 24Vertex trial`;
	const studentName = escapeHtml(params.studentName ?? "there");

	const html = renderEmailShell({
		preheader:
			params.daysLeft <= 0
				? "Add a payment method today to keep practicing without interruption."
				: `${params.daysLeft} day${params.daysLeft === 1 ? "" : "s"} left — add a payment method now.`,
		greeting: `Hi ${studentName},`,
		title: subject,
		paragraphs: [
			"Your 14-day free trial is wrapping up. Add a payment method now so your practice doesn't pause — you won't be charged until the trial actually ends.",
			"Switch to <strong>Pro Monthly</strong> or <strong>Pro Annual</strong> in one tap.",
		],
		primaryCta: { label: "Continue with Pro", href: `${getAppUrl()}/student/subscription` },
	});

	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		unsubscribeRecipientUserId: params.recipientUserId ?? null,
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
	const subject = "Payment received — 24Vertex";
	const studentName = escapeHtml(params.studentName ?? "there");
	const stats: { label: string; value: string }[] = [{ label: "Amount", value: params.amountLabel }];
	if (params.planName) stats.push({ label: "Plan", value: params.planName });
	if (params.paymentRef) stats.push({ label: "Reference", value: params.paymentRef });

	const paragraphs = [
		`Thanks for your payment. We've recorded it and your subscription remains active.`,
		params.invoiceShortUrl
			? "Your hosted Razorpay invoice is available below."
			: "You can review payment history anytime in your subscription settings.",
	];

	const primaryCta = params.invoiceShortUrl
		? { label: "View invoice", href: params.invoiceShortUrl }
		: { label: "Payment history", href: `${getAppUrl()}/student/subscription` };

	const html = renderEmailShell({
		preheader: `${params.amountLabel} paid${params.planName ? ` for ${params.planName}` : ""}.`,
		greeting: `Hi ${studentName},`,
		title: subject,
		paragraphs,
		stats,
		primaryCta,
		secondaryCta: params.invoiceShortUrl ? { label: "Payment history", href: `${getAppUrl()}/student/subscription` } : undefined,
	});

	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		subject,
		html,
		templateSlug: "payment-receipt",
		templateVariables: {
			student_name: params.studentName ?? "there",
			amount_label: params.amountLabel,
			plan_name: params.planName ?? "",
			payment_ref: params.paymentRef ?? "",
			invoice_short_url: params.invoiceShortUrl ?? "",
		},
	});
}

export type SubscriptionActiveParams = CommonParams & { planName: string; nextRenewalIso: string };
export async function sendSubscriptionActiveEmail(params: SubscriptionActiveParams): Promise<{ error: string | null }> {
	const subject = `Welcome to ${params.planName}!`;
	const renewal = formatDateLongDMYInAppTimeZone(params.nextRenewalIso);
	const studentName = escapeHtml(params.studentName ?? "there");
	const planName = escapeHtml(params.planName);

	const html = renderEmailShell({
		preheader: `Your ${params.planName} subscription is now active. Next renewal: ${renewal}.`,
		greeting: `Hi ${studentName},`,
		title: subject,
		paragraphs: [
			`Your <strong>${planName}</strong> subscription is now active. Enjoy unlimited practice and the expanded AI output allowance for doubt chat.`,
		],
		stats: [{ label: "Next renewal", value: renewal }],
		primaryCta: { label: "Open 24Vertex", href: `${getAppUrl()}/student/dashboard` },
	});

	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		unsubscribeRecipientUserId: params.recipientUserId ?? null,
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

export type PaymentFailedParams = CommonParams & { dedupKey?: string };
export async function sendPaymentFailedEmail(params: PaymentFailedParams): Promise<{ error: string | null }> {
	const subject = "We couldn't collect your 24Vertex payment";
	const studentName = escapeHtml(params.studentName ?? "there");

	const html = renderEmailShell({
		preheader: "Your payment was declined. Razorpay will retry — update your method to avoid an interruption.",
		greeting: `Hi ${studentName},`,
		title: subject,
		paragraphs: [
			"We tried to charge your payment method for your 24Vertex subscription but it was declined. Razorpay will retry automatically.",
			"To avoid an interruption, please check your UPI or card mandate status, or update your payment method.",
		],
		callout: { tone: "warning", text: "Practice continues for a short grace window. Updating payment now keeps things uninterrupted." },
		primaryCta: { label: "Fix payment method", href: `${getAppUrl()}/student/subscription` },
	});

	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		subject,
		html,
		templateSlug: "subscription-payment-failed",
		templateVariables: { student_name: params.studentName ?? "there" },
		dedupKey: params.dedupKey,
	});
}

/**
 * W4.3 — dunning reminder for day-3 / day-7 of a halted/past_due subscription.
 *
 * The day-0 message goes out via sendPaymentFailedEmail when the
 * subscription.halted/payment.failed webhook fires. Day-3 and day-7 ramp up
 * urgency before the day-14 hard cancel.
 */
export type DunningReminderParams = CommonParams & {
	dayNumber: 3 | 7;
	subscriptionId: string;
};

export async function sendDunningReminderEmail(
	params: DunningReminderParams,
): Promise<{ error: string | null }> {
	const studentName = escapeHtml(params.studentName ?? "there");
	const subject =
		params.dayNumber === 3
			? "Reminder: payment still pending on 24Vertex"
			: "Final reminder: your 24Vertex subscription will be cancelled in 7 days";
	const urgency =
		params.dayNumber === 3
			? "It's been 3 days since we couldn't collect your subscription payment."
			: "It's been a week since your last successful payment.";
	const callout =
		params.dayNumber === 3
			? "Update your payment method now to keep practice access uninterrupted."
			: "If we don't hear from you in the next 7 days we'll cancel the subscription. You can resubscribe any time.";

	const html = renderEmailShell({
		preheader: urgency,
		greeting: `Hi ${studentName},`,
		title: subject,
		paragraphs: [
			urgency,
			"Common causes are an expired card, paused UPI mandate, or insufficient balance at the time of charge.",
		],
		callout: { tone: "warning", text: callout },
		primaryCta: { label: "Update payment method", href: `${getAppUrl()}/student/subscription` },
	});

	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId ?? null,
		subject,
		html,
		templateSlug: `subscription-dunning-day-${params.dayNumber}`,
		templateVariables: { student_name: params.studentName ?? "there", day_number: String(params.dayNumber) },
		dedupKey: `${params.subscriptionId}:dunning-day-${params.dayNumber}`,
	});
}

// `sendUsageNearLimitEmail` (template slug `usage-near-limit`) was removed
// after Sprint 3: the granular `usage-tests-*` / `usage-tokens-*` helpers in
// `notifications-emails.ts` cover every caller, the legacy helper had no
// importers in production code, and keeping a parallel "you're at X%" template
// risks drift between admin DB templates. If you need a generic threshold
// email back, prefer extending the granular templates rather than restoring
// this slug.
