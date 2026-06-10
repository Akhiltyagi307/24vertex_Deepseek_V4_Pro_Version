import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";

import { db } from "@/db";
import { emailLog } from "@/db/schema/comms-audit";
import { emailWebhookEvents } from "@/db/schema/email-webhook-events";

export const runtime = "nodejs";

/**
 * Constant-time string equality. Length check is fine to short-circuit (it's
 * not part of the secret), but the byte comparison must be timing-safe so a
 * remote attacker cannot leak the secret one character at a time via response
 * latency. Node's crypto.timingSafeEqual requires equal-length buffers — the
 * length guard above ensures that invariant.
 */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/**
 * Resend webhook — updates `email_log` rows by `provider_message_id`.
 *
 * Auth:
 *   - **Production:** Resend signs payloads with Svix. Set `RESEND_WEBHOOK_SECRET`
 *     to the signing secret from the Resend dashboard (starts with `whsec_`).
 *   - **Local / manual:** `Authorization: Bearer <RESEND_WEBHOOK_BEARER>` — a
 *     dedicated secret, distinct from the Svix signing secret, so a leaked bearer
 *     header can't compromise signature verification. Unset ⇒ fallback disabled.
 *     The earlier `?token=<secret>` query-param fallback was removed (W: 2026-05)
 *     because query strings leak to proxy access logs.
 *
 * Idempotency: Svix guarantees at-least-once delivery. The route INSERTs the
 * `svix-id` into `email_webhook_events` with `ON CONFLICT (svix_id) DO NOTHING
 * RETURNING id`. If no row is returned, this is a retry of an event we've
 * already processed — short-circuit with `{ ok: true, deduped: true }` and
 * leave `email_log` untouched. That keeps an out-of-order `delivered` retry
 * after a `bounced` from silently clobbering the bounced state.
 *
 * The signed-fallback (Authorization: Bearer) path also dedupes via a
 * `local:<sha256(body)>` synthetic id — manual replays from curl with the
 * same body return `deduped: true` on the second hit, which matches the
 * production semantics.
 */
export async function POST(request: NextRequest) {
	const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
	if (!secret) {
		return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
	}

	const body = await request.text();

	const svixId = request.headers.get("svix-id");
	const svixTs = request.headers.get("svix-timestamp");
	const svixSig = request.headers.get("svix-signature");

	let payload: Record<string, unknown>;
	let dedupId: string;

	if (svixId && svixTs && svixSig) {
		try {
			const wh = new Webhook(secret);
			payload = wh.verify(body, {
				"svix-id": svixId,
				"svix-timestamp": svixTs,
				"svix-signature": svixSig,
			}) as Record<string, unknown>;
		} catch {
			return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
		}
		dedupId = svixId;
	} else {
		// Dedicated bearer secret for the manual/local path so the Svix signing
		// secret (RESEND_WEBHOOK_SECRET) is never accepted as a plain bearer
		// credential. When RESEND_WEBHOOK_BEARER is unset, the fallback is closed.
		const bearerSecret = process.env.RESEND_WEBHOOK_BEARER?.trim();
		const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
		if (!bearerSecret || !auth || !timingSafeEqual(auth, bearerSecret)) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		try {
			payload = JSON.parse(body) as Record<string, unknown>;
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
		}
		// Manual/curl replays use a synthetic dedup id derived from the body so
		// re-POSTing the same payload twice is idempotent. The Bearer secret has
		// already verified the caller's authority.
		dedupId = `local:${crypto.createHash("sha256").update(body).digest("hex")}`;
	}

	const type = String(payload.type ?? payload.event ?? "");

	// Idempotency check: insert the event row with `ON CONFLICT DO NOTHING`.
	// If the INSERT didn't produce a row, this svix_id has already been
	// processed — return ok+deduped without touching email_log so a retry that
	// arrives out-of-order can't clobber a later, more-authoritative state.
	const inserted = await db
		.insert(emailWebhookEvents)
		.values({
			svixId: dedupId,
			eventType: type || "unknown",
			payload,
		})
		.onConflictDoNothing({ target: emailWebhookEvents.svixId })
		.returning({ id: emailWebhookEvents.id });

	if (inserted.length === 0) {
		return NextResponse.json({ ok: true, deduped: true });
	}

	const data = (payload.data ?? payload.record ?? {}) as Record<string, unknown>;
	const emailId =
		(typeof data.email_id === "string" && data.email_id) ||
		(typeof data.id === "string" && data.id) ||
		null;

	if (!emailId) {
		// Mark the event row as processed even though we had nothing to update.
		await db
			.update(emailWebhookEvents)
			.set({ processedAt: new Date() })
			.where(eq(emailWebhookEvents.id, inserted[0].id));
		return NextResponse.json({ ok: true, skipped: true });
	}

	let status: string | undefined;
	if (type.includes("delivered")) status = "delivered";
	else if (type.includes("bounce") || type.includes("complained")) status = "bounced";
	else if (type.includes("failed")) status = "failed";

	const low = type.toLowerCase();
	await db
		.update(emailLog)
		.set({
			...(status ? { status } : {}),
			...(low.includes("opened") ? { openedAt: new Date() } : {}),
			...(low.includes("clicked") ? { clickedAt: new Date() } : {}),
			providerPayload: payload,
		})
		.where(eq(emailLog.providerMessageId, emailId));

	await db
		.update(emailWebhookEvents)
		.set({ processedAt: sql`now()` })
		.where(eq(emailWebhookEvents.id, inserted[0].id));

	return NextResponse.json({ ok: true });
}
