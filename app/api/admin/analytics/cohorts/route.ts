import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

/**
 * Monthly signup cohort sizes (students). Retention cells can be layered on later.
 */
export async function GET() {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const q = sql`
		select date_trunc('month', created_at)::date as cohort_month,
		       count(*)::int as cohort_size
		from profiles
		where role = 'student'
		  and deleted_at is null
		  and created_at >= now() - interval '12 months'
		group by 1
		order by 1 asc
	`;

	const rows = await db.execute(q);
	return NextResponse.json({ cohorts: rows as unknown as { cohort_month: string; cohort_size: number }[] }, { headers: adminHeaders() });
}
