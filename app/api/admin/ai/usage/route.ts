import { and, count, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";
import { aiCalls } from "@/db/schema/ai-calls";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const sp = request.nextUrl.searchParams;
	const from = sp.get("from");
	const to = sp.get("to");
	const feature = sp.get("feature");

	const conditions = [];
	if (from) {
		const d = new Date(from);
		if (!Number.isNaN(d.getTime())) conditions.push(gte(aiCalls.createdAt, d));
	}
	if (to) {
		const d = new Date(to);
		if (!Number.isNaN(d.getTime())) conditions.push(lte(aiCalls.createdAt, d));
	}
	if (feature) conditions.push(eq(aiCalls.feature, feature));
	const whereSql = conditions.length ? and(...conditions) : undefined;

	const byFeature = await db
		.select({
			feature: aiCalls.feature,
			n: count(),
			inSum: sql<number>`sum(${aiCalls.inputTokens})::bigint`,
			outSum: sql<number>`sum(${aiCalls.outputTokens})::bigint`,
		})
		.from(aiCalls)
		.where(whereSql)
		.groupBy(aiCalls.feature);

	const topWhere = whereSql ? and(whereSql, isNotNull(aiCalls.userId)) : isNotNull(aiCalls.userId);

	const topUsers = await db
		.select({
			userId: aiCalls.userId,
			tokens: sql<number>`sum(${aiCalls.inputTokens} + ${aiCalls.outputTokens})::bigint`,
		})
		.from(aiCalls)
		.where(topWhere)
		.groupBy(aiCalls.userId)
		.orderBy(desc(sql`sum(${aiCalls.inputTokens} + ${aiCalls.outputTokens})`))
		.limit(10);

	const recent = await db
		.select()
		.from(aiCalls)
		.where(whereSql)
		.orderBy(desc(aiCalls.createdAt))
		.limit(50);

	return NextResponse.json(
		{
			by_feature: byFeature,
			top_users: topUsers,
			recent,
		},
		{ headers: adminHeaders() },
	);
}
