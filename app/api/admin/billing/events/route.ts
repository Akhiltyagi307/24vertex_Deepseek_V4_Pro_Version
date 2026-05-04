import { and, count, desc, eq, ilike, isNull, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";
import { billingEvents } from "@/db/schema/billing";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const sp = request.nextUrl.searchParams;
		const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
		const pageSize = Math.min(200, Math.max(1, Number(sp.get("page_size") ?? "40") || 40));
		const offset = (page - 1) * pageSize;
		const processed = sp.get("processed");
		const q = sp.get("q")?.trim();
		const eventType = sp.get("event_type")?.trim();

		const conditions: SQL[] = [];
		if (processed === "1") conditions.push(isNotNull(billingEvents.processedAt));
		if (processed === "0") conditions.push(isNull(billingEvents.processedAt));
		if (eventType) conditions.push(eq(billingEvents.eventType, eventType));
		if (q) {
			const pattern = `%${q.replace(/%/g, "\\%")}%`;
			conditions.push(or(ilike(billingEvents.razorpayEventId, pattern), ilike(billingEvents.eventType, pattern))!);
		}
		const whereSql = conditions.length ? and(...conditions) : undefined;

		const base = db
			.select({
				id: billingEvents.id,
				razorpayEventId: billingEvents.razorpayEventId,
				eventType: billingEvents.eventType,
				processedAt: billingEvents.processedAt,
				error: billingEvents.error,
				createdAt: billingEvents.createdAt,
				replayCount: billingEvents.replayCount,
				lastReplayAt: billingEvents.lastReplayAt,
				resolvedAt: billingEvents.resolvedAt,
			})
			.from(billingEvents)
			.$dynamic();

		const rowQuery = whereSql ? base.where(whereSql) : base;
		const rows = await rowQuery.orderBy(desc(billingEvents.createdAt)).limit(pageSize).offset(offset);

		const countQ = db.select({ total: count() }).from(billingEvents);
		const [{ total }] = await (whereSql ? countQ.where(whereSql) : countQ);

		return NextResponse.json(
			{
				data: rows.map((r) => ({
					id: r.id,
					razorpay_event_id: r.razorpayEventId,
					event_type: r.eventType,
					processed_at: r.processedAt?.toISOString() ?? null,
					error: r.error,
					created_at: r.createdAt.toISOString(),
					replay_count: r.replayCount,
					last_replay_at: r.lastReplayAt?.toISOString() ?? null,
					resolved_at: r.resolvedAt?.toISOString() ?? null,
				})),
				total: Number(total ?? 0),
				page,
				page_size: pageSize,
			},
			{ headers: adminHeaders() },
		);
	});
}
