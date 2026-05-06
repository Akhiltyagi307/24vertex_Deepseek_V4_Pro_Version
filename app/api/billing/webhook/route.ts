import { createHash } from "node:crypto";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { processRazorpayWebhookPayload, type RazorpayWebhookBody } from "@/lib/billing/razorpay-webhook-processor";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { InvalidStateTransitionError } from "@/lib/billing/subscription-state-machine";
import { logServerError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deterministic dedup key when Razorpay omits a top-level event id.
 *
 * Order of preference:
 *   1. `body.id` (Razorpay's own event id — always present in production webhooks).
 *   2. `event_type:<entity_id>` keyed off payment / subscription / invoice id.
 *   3. SHA-256 of the verified raw body. The signature check has already
 *      passed, so the raw bytes are trustworthy and stable across retries.
 *
 * Never uses wall-clock time — two events arriving within the same second
 * with the same payload would otherwise collide and silently drop one.
 */
function deriveWebhookDedupId(body: RazorpayWebhookBody, raw: string): string {
	const topEventId = typeof body.id === "string" && body.id.length > 0 ? body.id : null;
	if (topEventId) return topEventId;

	const paymentId = (body.payload?.payment?.entity as { id?: string } | undefined)?.id;
	const subscriptionId = (body.payload?.subscription?.entity as { id?: string } | undefined)?.id;
	const invoiceId = (body.payload?.invoice?.entity as { id?: string } | undefined)?.id;
	const invoicePaymentId = (body.payload?.invoice?.entity as { payment_id?: string } | undefined)?.payment_id;
	const entityId = paymentId ?? subscriptionId ?? invoicePaymentId ?? invoiceId;
	if (entityId) {
		return `${body.event}:${entityId}`;
	}

	// W1.5: full 64-char SHA-256 digest. The previous .slice(0, 32) truncated
	// to 32 hex chars (128 bits of entropy), which is enough in practice but
	// has no upside vs the full digest — collision risk was theoretical, not
	// real, but the fix is one character.
	const hash = createHash("sha256").update(raw).digest("hex");
	return `${body.event}:sha256:${hash}`;
}

// Sample the signature-failure Sentry capture so a sustained attack (or
// misconfigured secret rotation) doesn't drown the alert channel. One capture
// per minute is plenty to notice; further failures show up in access logs.
// Module-level state survives across requests in the same process and resets
// on cold start, which is the right granularity for serverless.
let lastSignatureFailureCaptureMs = 0;
const SIGNATURE_FAILURE_CAPTURE_INTERVAL_MS = 60_000;

function maybeCaptureSignatureFailure(extra: Record<string, unknown>): void {
	const now = Date.now();
	if (now - lastSignatureFailureCaptureMs < SIGNATURE_FAILURE_CAPTURE_INTERVAL_MS) return;
	lastSignatureFailureCaptureMs = now;
	Sentry.captureMessage("billing.webhook.signature_invalid", {
		level: "warning",
		tags: { component: "billing.webhook", phase: "verify_signature" },
		extra,
	});
}

export async function POST(req: Request) {
	const raw = await req.text();
	const signature = req.headers.get("x-razorpay-signature");
	if (!verifyWebhookSignature(raw, signature)) {
		// W1.6: 400 (not 401) — Razorpay retries 4xx and 5xx alike for 24h, but
		// 400 is the conventionally-correct semantic for "this body is malformed
		// /unsignable" and gives Sentry/log filters a cleaner signal than 401
		// (which usually implies "missing auth, retry with creds"). The sampled
		// Sentry capture above absorbs spammy retries.
		maybeCaptureSignatureFailure({
			signature_header_present: typeof signature === "string" && signature.length > 0,
			signature_header_length: typeof signature === "string" ? signature.length : 0,
			body_byte_length: Buffer.byteLength(raw, "utf8"),
		});
		return Response.json({ ok: false, message: "Bad signature." }, { status: 400 });
	}

	let body: RazorpayWebhookBody;
	try {
		body = JSON.parse(raw) as RazorpayWebhookBody;
	} catch {
		return Response.json({ ok: false, message: "Invalid JSON." }, { status: 400 });
	}

	const admin = createServiceRoleClient();
	const eventId = deriveWebhookDedupId(body, raw);

	const { data: inserted, error: insertErr } = await admin
		.from("billing_events")
		.upsert(
			{
				razorpay_event_id: eventId,
				event_type: body.event,
				payload: body,
			},
			{ onConflict: "razorpay_event_id", ignoreDuplicates: true },
		)
		.select("id")
		.maybeSingle();

	if (insertErr) {
		Sentry.captureException(insertErr, {
			tags: { component: "billing.webhook", phase: "dedup_insert", event: body.event },
		});
		logServerError("billing.webhook.dedup_insert", insertErr);
		return Response.json({ ok: false }, { status: 500 });
	}

	if (!inserted) {
		return Response.json({ ok: true, deduped: true });
	}

	try {
		await processRazorpayWebhookPayload(admin, body);
		revalidatePath("/student", "layout");
		await admin.from("billing_events").update({ processed_at: new Date().toISOString() }).eq("razorpay_event_id", eventId);
	} catch (err) {
		// Forbidden state transitions are unrecoverable replays (e.g., a stale
		// subscription.activated event for a sub we already cancelled). Logging
		// and returning 200 stops Razorpay's 24-hour retry storm; the event is
		// already persisted in billing_events with the error message so an
		// admin can review. See W1.2 + subscription-state-machine.ts.
		if (err instanceof InvalidStateTransitionError) {
			Sentry.captureMessage("billing.webhook.invalid_state_transition", {
				level: "warning",
				tags: { component: "billing.webhook", event: body.event },
				extra: { from: err.from, to: err.to, subscription_id: err.subscriptionId },
			});
			await admin
				.from("billing_events")
				.update({ error: err.message })
				.eq("razorpay_event_id", eventId);
			return Response.json({ ok: true, skipped: "invalid_state_transition" });
		}
		Sentry.captureException(err, { tags: { component: "billing.webhook", event: body.event } });
		logServerError("billing.webhook.handle", err);
		await admin
			.from("billing_events")
			.update({ error: err instanceof Error ? err.message : String(err) })
			.eq("razorpay_event_id", eventId);
		return Response.json({ ok: false }, { status: 500 });
	}

	return Response.json({ ok: true });
}
