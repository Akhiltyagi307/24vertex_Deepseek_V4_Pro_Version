import { createHash } from "node:crypto";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { processRazorpayWebhookPayload, type RazorpayWebhookBody } from "@/lib/billing/razorpay-webhook-processor";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
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

	const hash = createHash("sha256").update(raw).digest("hex").slice(0, 32);
	return `${body.event}:sha256:${hash}`;
}

export async function POST(req: Request) {
	const raw = await req.text();
	const signature = req.headers.get("x-razorpay-signature");
	if (!verifyWebhookSignature(raw, signature)) {
		Sentry.captureMessage("billing.webhook.signature_invalid", {
			level: "warning",
			tags: { component: "billing.webhook", phase: "verify_signature" },
			extra: {
				signature_header_present: typeof signature === "string" && signature.length > 0,
			},
		});
		return Response.json({ ok: false, message: "Bad signature." }, { status: 401 });
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
