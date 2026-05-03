import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";
import { operatorJobs } from "@/db/schema/operator-jobs";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { searchParams } = request.nextUrl;
		const status = searchParams.get("status");
		const queue = searchParams.get("queue");
		const limit = Math.min(Number.parseInt(searchParams.get("limit") ?? "100", 10) || 100, 500);

		const conditions = [];
		if (status) conditions.push(eq(operatorJobs.status, status));
		if (queue) conditions.push(eq(operatorJobs.queue, queue));

		const rows =
			conditions.length > 0
				? await db
						.select()
						.from(operatorJobs)
						.where(and(...conditions))
						.orderBy(desc(operatorJobs.createdAt))
						.limit(limit)
				: await db.select().from(operatorJobs).orderBy(desc(operatorJobs.createdAt)).limit(limit);

		return NextResponse.json({ data: rows }, { headers: adminHeaders() });
	});
}
