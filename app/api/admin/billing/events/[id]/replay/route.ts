import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction, writeAdminActionStrict } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { processRazorpayWebhookPayload, type RazorpayWebhookBody } from "@/lib/billing/razorpay-webhook-processor";
import { db } from "@/db";
import { billingEvents } from "@/db/schema/billing";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid id");

		const rows = await db.select().from(billingEvents).where(eq(billingEvents.id, uuid.data)).limit(1);
		const row = rows[0];
		if (!row) return adminErrorResponse("Not found", { status: 404 });

		const body = row.payload as RazorpayWebhookBody;
		if (!body?.event || !body.payload) {
			return adminErrorResponse("Invalid stored payload");
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
				action: ADMIN_ACTIONS.BILLING_EVENT_REPLAY_FAILED,
				targetType: "billing_event",
				targetId: uuid.data,
				payload: { error: msg },
				ipAddress: clientIpFromRequest(request),
				userAgent: userAgentFromRequest(request),
			});
			return adminErrorResponse(msg, { status: 500 });
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

		// Strict audit: webhook replay re-runs the Razorpay processor which
		// may create payments / send mail / mutate subscription state. A
		// missing audit row here is a compliance hole.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.BILLING_EVENT_REPLAY,
			targetType: "billing_event",
			targetId: uuid.data,
			payload: { event_type: row.eventType, razorpay_event_id: row.razorpayEventId },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
