import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { processRazorpayWebhookPayload, type RazorpayWebhookBody } from "@/lib/billing/razorpay-webhook-processor";
import { db } from "@/db";
import { billingEvents } from "@/db/schema/billing";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) {
			return NextResponse.json({ error: "Invalid id" }, { status: 400, headers: adminHeaders() });
		}

		const rows = await db.select().from(billingEvents).where(eq(billingEvents.id, uuid.data)).limit(1);
		const row = rows[0];
		if (!row) return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });

		const body = row.payload as RazorpayWebhookBody;
		if (!body?.event || !body.payload) {
			return NextResponse.json({ error: "Invalid stored payload" }, { status: 400, headers: adminHeaders() });
		}

		const admin = createServiceRoleClient();
		try {
			await processRazorpayWebhookPayload(admin, body);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			await db
				.update(billingEvents)
				.set({
					error: msg,
					lastReplayAt: new Date(),
					replayCount: sql`${billingEvents.replayCount} + 1`,
				})
				.where(eq(billingEvents.id, uuid.data));
			await writeAdminAction({
				action: "billing_event_replay_failed",
				targetType: "billing_event",
				targetId: uuid.data,
				payload: { error: msg },
				ipAddress: clientIpFromRequest(request),
				userAgent: userAgentFromRequest(request),
			});
			return NextResponse.json({ error: msg }, { status: 500, headers: adminHeaders() });
		}

		const now = new Date();
		await db
			.update(billingEvents)
			.set({
				processedAt: now,
				error: null,
				lastReplayAt: now,
				replayCount: sql`${billingEvents.replayCount} + 1`,
			})
			.where(eq(billingEvents.id, uuid.data));

		await writeAdminAction({
			action: "billing_event_replay",
			targetType: "billing_event",
			targetId: uuid.data,
			payload: { event_type: row.eventType, razorpay_event_id: row.razorpayEventId },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
