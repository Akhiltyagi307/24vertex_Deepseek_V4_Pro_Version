import "server-only";

import crypto from "node:crypto";
import Razorpay from "razorpay";

import { getRazorpayKeyId, getRazorpayKeySecret, getRazorpayWebhookSecret } from "@/lib/env";
import {
	RazorpayCustomerSchema,
	RazorpayInvoiceSchema,
	RazorpayPlanCreatedSchema,
	RazorpayPlanFetchedSchema,
	RazorpayRefundSchema,
	RazorpayRefundsListSchema,
	RazorpaySubscriptionSchema,
} from "./razorpay-schemas";

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
	notes?: Record<string, unknown> | null;
};

/**
 * Thrown by createOrFetchCustomer when Razorpay's email-and-contact dedup
 * returned a customer that was originally created for a different profile.
 *
 * The caller (create-subscription route) catches this specifically, audits
 * the collision on the subscription row, and returns 409 to the client. We do
 * NOT silently reuse the existing customer because the two profiles would then
 * share lifecycle events (cancel one, the other surprises break).
 */
export class RazorpayCustomerCollisionError extends Error {
	readonly razorpayCustomerId: string;
	readonly ownerProfileId: string;
	readonly attemptedProfileId: string;
	readonly customerEmail: string | null;

	constructor(opts: {
		razorpayCustomerId: string;
		ownerProfileId: string;
		attemptedProfileId: string;
		customerEmail: string | null;
	}) {
		super(
			`Razorpay customer ${opts.razorpayCustomerId} already owned by profile ${opts.ownerProfileId}; cannot reuse for profile ${opts.attemptedProfileId}.`,
		);
		this.name = "RazorpayCustomerCollisionError";
		this.razorpayCustomerId = opts.razorpayCustomerId;
		this.ownerProfileId = opts.ownerProfileId;
		this.attemptedProfileId = opts.attemptedProfileId;
		this.customerEmail = opts.customerEmail;
	}
}

export async function createOrFetchCustomer(input: {
	existingCustomerId?: string | null;
	name: string;
	email: string;
	contact?: string | null;
	notes?: Record<string, string>;
	/**
	 * Profile id that this customer is being created/fetched for. When set,
	 * we validate that any returned customer's notes.profile_id matches —
	 * otherwise we throw RazorpayCustomerCollisionError.
	 */
	expectedProfileId?: string;
}): Promise<RazorpayCustomer> {
	const rzp = getRazorpayClient();
	if (input.existingCustomerId) {
		const existing = RazorpayCustomerSchema.parse(await rzp.customers.fetch(input.existingCustomerId));
		assertCustomerOwnership(existing, input.expectedProfileId);
		return existing;
	}
	try {
		// `fail_existing=0` returns the existing record if the email+contact pair
		// is already registered. We must validate ownership on the response —
		// see RazorpayCustomerCollisionError above.
		const created = RazorpayCustomerSchema.parse(
			await rzp.customers.create({
				name: input.name,
				email: input.email,
				contact: input.contact ?? undefined,
				fail_existing: 0,
				notes: input.notes,
			}),
		);
		assertCustomerOwnership(created, input.expectedProfileId);
		return created;
	} catch (e) {
		if (e instanceof RazorpayCustomerCollisionError) throw e;
		throw new Error(
			`Razorpay customer create failed: ${e instanceof Error ? e.message : String(e)}`,
		);
	}
}

function assertCustomerOwnership(customer: RazorpayCustomer, expectedProfileId: string | undefined): void {
	if (!expectedProfileId) return;
	const ownerProfileId = typeof customer.notes?.profile_id === "string" ? customer.notes.profile_id : null;
	// If notes.profile_id is missing entirely, the customer pre-dates our
	// notes-tagging convention — treat as legacy/unowned and allow reuse.
	if (!ownerProfileId) return;
	if (ownerProfileId === expectedProfileId) return;
	throw new RazorpayCustomerCollisionError({
		razorpayCustomerId: customer.id,
		ownerProfileId,
		attemptedProfileId: expectedProfileId,
		customerEmail: typeof customer.email === "string" ? customer.email : null,
	});
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
	/** Linked subscription offer (e.g. checkout % coupon). */
	offerId?: string;
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

// W5.3: Razorpay's documented limit is 9999 cycles. Asserting at the
// boundary means a typo-bumped 99999 fails fast in our process, not at
// Razorpay with a generic 4xx that's a pain to trace.
const RAZORPAY_MAX_TOTAL_COUNT = 9999;

export async function createSubscription(input: CreateSubscriptionInput): Promise<RazorpaySubscription> {
	const rzp = getRazorpayClient();
	if (!Number.isInteger(input.totalCount) || input.totalCount < 1 || input.totalCount > RAZORPAY_MAX_TOTAL_COUNT) {
		throw new Error(
			`Invalid totalCount=${input.totalCount}; Razorpay accepts 1..${RAZORPAY_MAX_TOTAL_COUNT}.`,
		);
	}
	const body: Record<string, unknown> = {
		plan_id: input.planId,
		total_count: input.totalCount,
		customer_notify: input.customerNotify ?? 1,
		quantity: 1,
	};
	if (input.startAt) body.start_at = input.startAt;
	if (input.expireBy) body.expire_by = input.expireBy;
	if (input.customerId) body.customer_id = input.customerId;
	if (input.offerId) body.offer_id = input.offerId;
	if (input.notes) body.notes = input.notes;
	return RazorpaySubscriptionSchema.parse(await rzp.subscriptions.create(body as never));
}

export async function fetchSubscription(subscriptionId: string): Promise<RazorpaySubscription> {
	const rzp = getRazorpayClient();
	return RazorpaySubscriptionSchema.parse(await rzp.subscriptions.fetch(subscriptionId));
}

export async function cancelSubscription(
	subscriptionId: string,
	opts: { cancelAtCycleEnd?: boolean } = {},
): Promise<RazorpaySubscription> {
	const rzp = getRazorpayClient();
	const cancelAtCycleEnd = opts.cancelAtCycleEnd ? 1 : 0;
	return RazorpaySubscriptionSchema.parse(
		await rzp.subscriptions.cancel(subscriptionId, cancelAtCycleEnd as unknown as boolean),
	);
}

export async function pauseSubscription(
	subscriptionId: string,
	opts: { pauseAt?: "now" } = {},
): Promise<RazorpaySubscription> {
	const rzp = getRazorpayClient();
	const pauseFn = (rzp.subscriptions as unknown as {
		pause: (id: string, body: Record<string, unknown>) => Promise<unknown>;
	}).pause;
	return RazorpaySubscriptionSchema.parse(await pauseFn(subscriptionId, { pause_at: opts.pauseAt ?? "now" }));
}

export async function resumeSubscription(
	subscriptionId: string,
	opts: { resumeAt?: "now" } = {},
): Promise<RazorpaySubscription> {
	const rzp = getRazorpayClient();
	const resumeFn = (rzp.subscriptions as unknown as {
		resume: (id: string, body: Record<string, unknown>) => Promise<unknown>;
	}).resume;
	return RazorpaySubscriptionSchema.parse(await resumeFn(subscriptionId, { resume_at: opts.resumeAt ?? "now" }));
}

export async function updateSubscriptionPlan(
	subscriptionId: string,
	newPlanId: string,
	opts: { scheduleChangeAt?: "now" | "cycle_end"; customerNotify?: 0 | 1 } = {},
): Promise<RazorpaySubscription> {
	const rzp = getRazorpayClient();
	return RazorpaySubscriptionSchema.parse(
		await rzp.subscriptions.update(subscriptionId, {
			plan_id: newPlanId,
			schedule_change_at: opts.scheduleChangeAt ?? "now",
			customer_notify: opts.customerNotify ?? 1,
		} as never),
	);
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

export type RazorpayPlanFetched = {
	id: string;
	period?: string;
	interval?: number;
	item?: { name?: string; amount?: number; currency?: string };
};

/** Loads a plan from Razorpay (amount in paise on `item.amount`). */
export async function fetchRazorpayPlan(planId: string): Promise<RazorpayPlanFetched> {
	const rzp = getRazorpayClient();
	return RazorpayPlanFetchedSchema.parse(await rzp.plans.fetch(planId));
}

export async function createPlan(input: RazorpayPlanInput): Promise<{ id: string }> {
	const rzp = getRazorpayClient();
	return RazorpayPlanCreatedSchema.parse(
		await rzp.plans.create({
			period: input.period,
			interval: input.interval,
			item: {
				name: input.name,
				amount: input.amountPaise,
				currency: input.currency ?? "INR",
				description: input.description,
			},
			notes: input.notes,
		} as never),
	);
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
	return RazorpayInvoiceSchema.parse(await rzp.invoices.fetch(invoiceId));
}

export type RazorpayRefund = {
	id: string;
	amount?: number;
	status?: string;
	payment_id?: string;
	created_at?: number;
	notes?: Record<string, unknown> | null;
};

/** Partial refund when `amountPaise` is set; else full refund. */
export async function refundPayment(
	razorpayPaymentId: string,
	opts: { amountPaise?: number; notes?: Record<string, string> } = {},
): Promise<RazorpayRefund> {
	const rzp = getRazorpayClient();
	const body: Record<string, unknown> = {};
	if (opts.amountPaise != null) body.amount = opts.amountPaise;
	if (opts.notes) body.notes = opts.notes;
	return RazorpayRefundSchema.parse(await rzp.payments.refund(razorpayPaymentId, body as never));
}

/**
 * List all refunds attached to a Razorpay payment. Used by the W3.3
 * reconciliation cron to recover orphan idempotency rows: when our
 * post-Razorpay-update DB write failed, we don't have the refund_id locally
 * but we know the payment_id, so we ask Razorpay which refunds it has.
 */
export async function fetchPaymentRefunds(razorpayPaymentId: string): Promise<RazorpayRefund[]> {
	const rzp = getRazorpayClient();
	const parsed = RazorpayRefundsListSchema.parse(await rzp.payments.fetchMultipleRefund(razorpayPaymentId));
	return parsed.items;
}

// ------------------------------------------------------------
// Webhook verification
// ------------------------------------------------------------

function razorpayWebhookSecretList(): string[] {
	const primary = getRazorpayWebhookSecret();
	const extraRaw = process.env.RAZORPAY_WEBHOOK_SECRET_EXTRA?.trim() ?? "";
	const extras = extraRaw
		? extraRaw
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s.length > 0)
		: [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const s of [primary, ...extras]) {
		if (!seen.has(s)) {
			seen.add(s);
			out.push(s);
		}
	}
	return out;
}

function timingSafeEqualDigest(mac: Buffer, signatureUtf8: string): boolean {
	const sig = signatureUtf8.trim();
	if (!sig) return false;
	// Razorpay: hex-encoded HMAC-SHA256 (64 hex chars).
	if (/^[0-9a-fA-F]+$/.test(sig) && sig.length === mac.length * 2) {
		try {
			const asHex = Buffer.from(sig, "hex");
			if (asHex.length === mac.length && crypto.timingSafeEqual(asHex, mac)) return true;
		} catch {
			/* invalid hex */
		}
	}
	// Some stacks send base64(raw digest); compare with constant-time equality on raw bytes.
	try {
		const asB64 = Buffer.from(sig, "base64");
		if (asB64.length === mac.length && crypto.timingSafeEqual(asB64, mac)) return true;
	} catch {
		/* invalid base64 */
	}
	return false;
}

/**
 * Verifies the `X-Razorpay-Signature` header against the raw request body
 * using HMAC-SHA256(webhookSecret). Returns true when valid.
 *
 * IMPORTANT: pass the raw body bytes (or the exact string from `req.text()`);
 * never serialize from a parsed JSON object because that loses whitespace.
 *
 * Optional `RAZORPAY_WEBHOOK_SECRET_EXTRA` (comma-separated) adds more signing keys
 * for local/staging harnesses — never use guessable values on internet-reachable hosts.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
	if (!signatureHeader?.trim()) return false;

	try {
		for (const secret of razorpayWebhookSecretList()) {
			const mac = crypto.createHmac("sha256", secret).update(rawBody).digest();
			if (timingSafeEqualDigest(mac, signatureHeader)) return true;
		}
		return false;
	} catch {
		return false;
	}
}
