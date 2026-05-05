import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_RESPONSE_HEADERS, adminErrorResponse } from "@/lib/admin/response";
import { adminGlobalSearch } from "@/lib/admin/search";

export const runtime = "nodejs";

const querySchema = z.object({
	q: z.string().trim().min(2, "q must be at least 2 characters").max(120),
});

const SEARCH_SLO_MS = 300;

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const raw = request.nextUrl.searchParams.get("q") ?? "";
		const parsed = querySchema.safeParse({ q: raw });
		if (!parsed.success) {
			return adminErrorResponse(parsed.error.flatten().fieldErrors.q?.[0] ?? "Invalid query", {
				code: "bad_request",
			});
		}

		const t0 = performance.now();
		const hits = await adminGlobalSearch(parsed.data.q);
		const durationMs = Math.round(performance.now() - t0);

		scope.setContext("admin_search", { duration_ms: durationMs, q_len: parsed.data.q.length });
		Sentry.addBreadcrumb({
			category: "admin.search",
			message: "admin_global_search",
			level: durationMs > SEARCH_SLO_MS ? "warning" : "info",
			data: { duration_ms: durationMs },
		});
		if (durationMs > SEARCH_SLO_MS) {
			Sentry.captureMessage(`admin_search_slow:${durationMs}ms`, {
				level: "warning",
				fingerprint: ["admin-search-slow"],
			});
		}

		// Custom shape (`{ data, meta }`) — clients want the duration_ms
		// alongside the hits. Keep the shape but apply canonical headers.
		return NextResponse.json(
			{ data: hits, meta: { duration_ms: durationMs } },
			{ headers: { ...ADMIN_RESPONSE_HEADERS } },
		);
	});
}
