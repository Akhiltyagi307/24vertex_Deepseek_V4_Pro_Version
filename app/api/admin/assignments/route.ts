import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { desc, sql } from "drizzle-orm";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";
import { assignments } from "@/db/schema/teaching";

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
		const pageSize = Math.min(100, Math.max(1, Number(sp.get("page_size") ?? "25") || 25));
		const offset = (page - 1) * pageSize;

		const rows = await db
			.select()
			.from(assignments)
			.orderBy(desc(assignments.updatedAt))
			.limit(pageSize)
			.offset(offset);

		const [{ c: totalRaw }] = await db.select({ c: sql<number>`count(*)::int` }).from(assignments);
		const total = Number(totalRaw) || 0;

		return NextResponse.json({ data: rows, total, page, page_size: pageSize }, { headers: adminHeaders() });
	});
}
