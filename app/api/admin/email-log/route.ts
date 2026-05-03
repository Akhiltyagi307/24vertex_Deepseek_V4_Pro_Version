import { and, count, desc, eq, gte, ilike, isNotNull, lte, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";
import { emailLog } from "@/db/schema/comms-audit";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const sp = request.nextUrl.searchParams;
	const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
	const pageSize = Math.min(200, Math.max(1, Number(sp.get("page_size") ?? "25") || 25));
	const offset = (page - 1) * pageSize;
	const status = sp.get("status");
	const template = sp.get("template");
	const q = sp.get("q");
	const from = sp.get("from");
	const to = sp.get("to");
	const hasError = sp.get("has_error") === "1";

	const conditions = [];
	if (status) conditions.push(eq(emailLog.status, status));
	if (template) conditions.push(eq(emailLog.template, template));
	if (q?.trim()) {
		const p = `%${q.trim().replace(/%/g, "\\%")}%`;
		conditions.push(
			or(ilike(emailLog.recipientEmail, p), ilike(emailLog.subject, p), ilike(emailLog.providerMessageId, p))!,
		);
	}
	if (from) {
		const d = new Date(from);
		if (!Number.isNaN(d.getTime())) conditions.push(gte(emailLog.createdAt, d));
	}
	if (to) {
		const d = new Date(to);
		if (!Number.isNaN(d.getTime())) conditions.push(lte(emailLog.createdAt, d));
	}
	if (hasError) {
		conditions.push(isNotNull(emailLog.errorMessage));
	}
	const whereSql = conditions.length ? and(...conditions) : undefined;

	const data = await db
		.select()
		.from(emailLog)
		.where(whereSql)
		.orderBy(desc(emailLog.createdAt))
		.limit(pageSize)
		.offset(offset);

	const [cntRow] = await db.select({ c: count() }).from(emailLog).where(whereSql);
	const total = Number(cntRow?.c ?? 0);

	return NextResponse.json({ data, total, page, page_size: pageSize }, { headers: adminHeaders() });
}
