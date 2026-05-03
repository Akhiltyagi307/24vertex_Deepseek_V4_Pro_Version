import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";

import { db } from "@/db";
import { emailLog } from "@/db/schema/comms-audit";

export const runtime = "nodejs";

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let out = 0;
	for (let i = 0; i < a.length; i++) {
		out |= a.charCodeAt(i)! ^ b.charCodeAt(i)!;
	}
	return out === 0;
}

/**
 * Resend webhook — updates `email_log` rows by `provider_message_id`.
 *
 * **Production:** Resend signs payloads with Svix. Set `RESEND_WEBHOOK_SECRET` to the
 * signing secret from the Resend dashboard for this endpoint (starts with `whsec_`).
 *
 * **Local / manual:** `Authorization: Bearer <same secret>` or `?token=<secret>` when
 * not using Svix headers (e.g. curl with a shared random string — not for real Resend traffic).
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
	} else {
		const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
		const qp = request.nextUrl.searchParams.get("token") ?? "";
		const ok =
			(auth && timingSafeEqual(auth, secret)) || (qp && timingSafeEqual(qp, secret));
		if (!ok) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		try {
			payload = JSON.parse(body) as Record<string, unknown>;
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
		}
	}

	const type = String(payload.type ?? payload.event ?? "");
	const data = (payload.data ?? payload.record ?? {}) as Record<string, unknown>;
	const emailId =
		(typeof data.email_id === "string" && data.email_id) ||
		(typeof data.id === "string" && data.id) ||
		null;

	if (!emailId) {
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

	return NextResponse.json({ ok: true });
}
