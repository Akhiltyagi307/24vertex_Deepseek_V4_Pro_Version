import "server-only";

import crypto from "node:crypto";
import Razorpay from "razorpay";

import { getRazorpayKeyId, getRazorpayKeySecret, getRazorpayWebhookSecret } from "@/lib/env";

let _client: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
	if (_client) return _client;
	_client = new Razorpay({ key_id: getRazorpayKeyId(), key_secret: getRazorpayKeySecret() });
	return _client;
}

// ------------------------------------------------------------
// Customer
// ------------------------------------------------------------

export type RazorpayCustomer = {
	id: string;
	name?: string | null;
	email?: string | null;
	contact?: string | null;
};

export async function createOrFetchCustomer(input: {
	existingCustomerId?: string | null;
	name: string;
	email: string;
	contact?: string | null;
	notes?: Record<string, string>;
}): Promise<RazorpayCustomer> {
	const rzp = getRazorpayClient();
	if (input.existingCustomerId) {
		const existing = await rzp.customers.fetch(input.existingCustomerId);
		return existing as unknown as RazorpayCustomer;
	}
	try {
		// `fail_existing=0` returns the existing record if the email is already registered.
		const created = (await rzp.customers.create({
			name: input.name,
			email: input.email,
			contact: input.contact ?? undefined,
			fail_existing: 0,
			notes: input.notes,
		})) as unknown as RazorpayCustomer;
		return created;
	} catch (e) {
		throw new Error(
			`Razorpay customer create failed: ${e instanceof Error ? e.message : String(e)}`,
		);
	}
}

// ------------------------------------------------------------
// Subscriptions
// ------------------------------------------------------------

export type CreateSubscriptionInput = {
	planId: string;
	/** How many total billing cycles before the subscription completes. Max 9999 per Razorpay. */
	totalCount: number;
	/** Unix epoch (seconds) at which billing should start; used for "after_trial" mode. */
	startAt?: number;
	/** Unix epoch (seconds) after which no mandate re-auth is triggered. */
	expireBy?: number;
	customerId?: string;
	customerNotify?: 0 | 1;
	notes?: Record<string, string>;
};

export type RazorpaySubscription = {
	id: string;
	status: string;
	plan_id: string;
	customer_id?: string | null;
	short_url?: string | null;
	current_start?: number | null;
	current_end?: number | null;
	charge_at?: number | null;
	end_at?: number | null;
	start_at?: number | null;
	notes?: Record<string, string> | null;
};

export async function createSubscription(input: CreateSubscriptionInput): Promise<RazorpaySubscription> {
	const rzp = getRazorpayClient();
	const body: Record<string, unknown> = {
		plan_id: input.planId,
		total_count: input.totalCount,
		customer_notify: input.customerNotify ?? 1,
		quantity: 1,
	};
	if (input.startAt) body.start_at = input.startAt;
	if (input.expireBy) body.expire_by = input.expireBy;
	if (input.customerId) body.customer_id = input.customerId;
	if (input.notes) body.notes = input.notes;
	const sub = (await rzp.subscriptions.create(body as never)) as unknown as RazorpaySubscription;
	return sub;
}

export async function fetchSubscription(subscriptionId: string): Promise<RazorpaySubscription> {
	const rzp = getRazorpayClient();
	return (await rzp.subscriptions.fetch(subscriptionId)) as unknown as RazorpaySubscription;
}

export async function cancelSubscription(
	subscriptionId: string,
	opts: { cancelAtCycleEnd?: boolean } = {},
): Promise<RazorpaySubscription> {
	const rzp = getRazorpayClient();
	const cancelAtCycleEnd = opts.cancelAtCycleEnd ? 1 : 0;
	return (await rzp.subscriptions.cancel(
		subscriptionId,
		cancelAtCycleEnd as unknown as boolean,
	)) as unknown as RazorpaySubscription;
}

export async function updateSubscriptionPlan(subscriptionId: string, newPlanId: string): Promise<RazorpaySubscription> {
	const rzp = getRazorpayClient();
	return (await rzp.subscriptions.update(subscriptionId, {
		plan_id: newPlanId,
		schedule_change_at: "now",
	} as never)) as unknown as RazorpaySubscription;
}

// ------------------------------------------------------------
// Plans (seed helper; typically invoked once from scripts/)
// ------------------------------------------------------------

export type RazorpayPlanInput = {
	period: "monthly" | "yearly";
	interval: number;
	amountPaise: number;
	currency?: string;
	name: string;
	description?: string;
	notes?: Record<string, string>;
};

export async function createPlan(input: RazorpayPlanInput): Promise<{ id: string }> {
	const rzp = getRazorpayClient();
	const plan = (await rzp.plans.create({
		period: input.period,
		interval: input.interval,
		item: {
			name: input.name,
			amount: input.amountPaise,
			currency: input.currency ?? "INR",
			description: input.description,
		},
		notes: input.notes,
	} as never)) as unknown as { id: string };
	return plan;
}

// ------------------------------------------------------------
// Invoices (subscription receipts / hosted invoice link)
// ------------------------------------------------------------

export type RazorpayInvoice = {
	id: string;
	short_url?: string | null;
	payment_id?: string | null;
	subscription_id?: string | null;
	amount?: number;
	currency?: string;
	status?: string;
};

export async function fetchInvoice(invoiceId: string): Promise<RazorpayInvoice> {
	const rzp = getRazorpayClient();
	return (await rzp.invoices.fetch(invoiceId)) as unknown as RazorpayInvoice;
}

// ------------------------------------------------------------
// Webhook verification
// ------------------------------------------------------------

/**
 * Verifies the `X-Razorpay-Signature` header against the raw request body
 * using HMAC-SHA256(webhookSecret). Returns true when valid.
 *
 * IMPORTANT: pass the raw body bytes (or the exact string from `req.text()`);
 * never serialize from a parsed JSON object because that loses whitespace.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
	if (!signatureHeader) return false;
	const expected = crypto
		.createHmac("sha256", getRazorpayWebhookSecret())
		.update(rawBody)
		.digest("hex");
	try {
		const a = Buffer.from(expected);
		const b = Buffer.from(signatureHeader);
		if (a.length !== b.length) return false;
		return crypto.timingSafeEqual(a, b);
	} catch {
		return false;
	}
}
