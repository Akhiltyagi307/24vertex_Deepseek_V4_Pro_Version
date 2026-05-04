import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";
import { billingEvents } from "@/db/schema/billing";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

		return NextResponse.json(
			{
				data: {
					id: row.id,
					razorpay_event_id: row.razorpayEventId,
					event_type: row.eventType,
					payload: row.payload,
					processed_at: row.processedAt?.toISOString() ?? null,
					error: row.error,
					created_at: row.createdAt.toISOString(),
					replay_count: row.replayCount,
					last_replay_at: row.lastReplayAt?.toISOString() ?? null,
					resolved_at: row.resolvedAt?.toISOString() ?? null,
					resolved_by: row.resolvedBy,
				},
			},
			{ headers: adminHeaders() },
		);
	});
}
