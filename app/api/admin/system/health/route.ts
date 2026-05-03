import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET() {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const rows = await db.execute(sql`
			SELECT DISTINCT ON (provider)
				provider,
				status,
				latency_ms,
				error,
				checked_at
			FROM public.service_health_pings
			ORDER BY provider, checked_at DESC
		`);

		const data = (rows as unknown as Record<string, unknown>[]).map((r) => ({
			provider: r.provider,
			status: r.status,
			latency_ms: r.latency_ms,
			error: r.error,
			checked_at: r.checked_at,
		}));

		return NextResponse.json({ data }, { headers: adminHeaders() });
	});
}
