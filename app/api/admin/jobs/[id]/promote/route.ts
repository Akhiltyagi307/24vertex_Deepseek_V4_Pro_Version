import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";
import { operatorJobs } from "@/db/schema/operator-jobs";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const rows = await db.select().from(operatorJobs).where(eq(operatorJobs.id, id)).limit(1);
		if (!rows[0]) {
			return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
		}

		return NextResponse.json(
			{
				error: "Promote is not supported for Postgres-backed operator jobs (no delayed queue state).",
				code: "promote_unsupported",
			},
			{ status: 400, headers: adminHeaders() },
		);
	});
}
