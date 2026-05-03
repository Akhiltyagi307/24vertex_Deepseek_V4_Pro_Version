import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { processRazorpayWebhookPayload, type RazorpayWebhookBody } from "@/lib/billing/razorpay-webhook-processor";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { logServerError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	const raw = await req.text();
	const signature = req.headers.get("x-razorpay-signature");
	if (!verifyWebhookSignature(raw, signature)) {
		return Response.json({ ok: false, message: "Bad signature." }, { status: 401 });
	}

	let body: RazorpayWebhookBody;
	try {
		body = JSON.parse(raw) as RazorpayWebhookBody;
	} catch {
		return Response.json({ ok: false, message: "Invalid JSON." }, { status: 400 });
	}

	const admin = createServiceRoleClient();
	const topEventId = typeof body.id === "string" && body.id.length > 0 ? body.id : null;
	const eventId =
		topEventId ??
		`${body.event}:${(body.payload?.payment?.entity as { id?: string } | undefined)?.id ?? (body.payload?.subscription?.entity as { id?: string } | undefined)?.id ?? (body.payload?.invoice?.entity as { payment_id?: string } | undefined)?.payment_id ?? ""}:${(body.payload?.subscription?.entity as { current_start?: number } | undefined)?.current_start ?? (body.payload?.invoice?.entity as { id?: string } | undefined)?.id ?? Math.floor(Date.now() / 1000)}`;

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
