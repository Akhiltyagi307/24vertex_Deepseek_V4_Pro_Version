import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminGlobalSearch } from "@/lib/admin/search";

export const runtime = "nodejs";

const querySchema = z.object({
	q: z.string().trim().min(2, "q must be at least 2 characters").max(120),
});

const SEARCH_SLO_MS = 300;

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const raw = request.nextUrl.searchParams.get("q") ?? "";
		const parsed = querySchema.safeParse({ q: raw });
		if (!parsed.success) {
			return NextResponse.json(
				{ error: parsed.error.flatten().fieldErrors.q?.[0] ?? "Invalid query", code: "bad_request" },
				{ status: 400, headers: adminHeaders() },
			);
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

		return NextResponse.json({ data: hits, meta: { duration_ms: durationMs } }, { headers: adminHeaders() });
	});
}
