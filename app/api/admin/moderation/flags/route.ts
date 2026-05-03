import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";
import { moderationFlags } from "@/db/schema/moderation-flags";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const status = request.nextUrl.searchParams.get("status") ?? "open";
		const limit = Math.min(Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10) || 100, 500);

		const rows =
			status === "all" ?
				await db.select().from(moderationFlags).orderBy(desc(moderationFlags.createdAt)).limit(limit)
			:	await db
					.select()
					.from(moderationFlags)
					.where(eq(moderationFlags.status, status))
					.orderBy(desc(moderationFlags.createdAt))
					.limit(limit);

		return NextResponse.json({ data: rows }, { headers: adminHeaders() });
	});
}
