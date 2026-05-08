import { desc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_RESPONSE_HEADERS } from "@/lib/admin/response";
import { db } from "@/db";
import { evalRuns } from "@/db/schema/eval-runs";

export const runtime = "nodejs";

/**
 * GET /api/admin/ai/evals
 *
 * Lists historical eval runs (newest first) for the dashboard list page.
 * Query: `?limit=` (1–200, default 50).
 *
 * Returns the summary columns only — drilldown comes from /[id].
 */
export async function GET(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const limitParam = request.nextUrl.searchParams.get("limit");
	const limit = Math.min(
		200,
		Math.max(1, Number.parseInt(limitParam ?? "50", 10) || 50),
	);

	const rows = await db
		.select()
		.from(evalRuns)
		.orderBy(desc(evalRuns.triggeredAt))
		.limit(limit);

	// Also surface a "latest by status" overview to render the dashboard
	// header without a second roundtrip.
	const [overview] = await db
		.select({
			total: sql<number>`count(*)::int`,
			completed: sql<number>`count(*) filter (where ${evalRuns.status} = 'complete')::int`,
			running: sql<number>`count(*) filter (where ${evalRuns.status} = 'running')::int`,
			lastTriggeredAt: sql<string | null>`max(${evalRuns.triggeredAt})`,
		})
		.from(evalRuns);

	return NextResponse.json(
		{ data: rows, overview },
		{ headers: { ...ADMIN_RESPONSE_HEADERS } },
	);
}
