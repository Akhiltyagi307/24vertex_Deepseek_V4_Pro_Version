import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_RESPONSE_HEADERS, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { evalRunResults, evalRuns } from "@/db/schema/eval-runs";

export const runtime = "nodejs";

/**
 * GET /api/admin/ai/evals/[id]
 *
 * Returns the run summary plus all per-fixture results, ordered by fixture id.
 * Powers the run-detail page (and the diff view, which fetches two of these
 * and diffs client-side).
 */
export async function GET(
	_request: NextRequest,
	ctx: { params: Promise<{ id: string }> },
) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;

	const [run] = await db.select().from(evalRuns).where(eq(evalRuns.id, id)).limit(1);
	if (!run) {
		return adminErrorResponse("Not found", { status: 404 });
	}

	const results = await db
		.select()
		.from(evalRunResults)
		.where(eq(evalRunResults.evalRunId, id));

	// Sort client-side for stable rendering
	results.sort((a, b) => a.fixtureId.localeCompare(b.fixtureId));

	return NextResponse.json(
		{ data: { run, results } },
		{ headers: { ...ADMIN_RESPONSE_HEADERS } },
	);
}
