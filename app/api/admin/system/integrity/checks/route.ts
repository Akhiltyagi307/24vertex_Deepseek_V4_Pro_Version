import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";
import { integrityCheckResults } from "@/db/schema/integrity-check-results";
import { INTEGRITY_CHECK_NAMES } from "@/lib/admin/integrity/check-runners";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET() {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const data = await Promise.all(
			INTEGRITY_CHECK_NAMES.map(async (checkName) => {
				const rows = await db
					.select()
					.from(integrityCheckResults)
					.where(eq(integrityCheckResults.checkName, checkName))
					.orderBy(desc(integrityCheckResults.ranAt))
					.limit(1);
				const last = rows[0];
				return {
					name: checkName,
					last_rows_found: last?.rowsFound ?? null,
					last_ran_at: last?.ranAt?.toISOString() ?? null,
				};
			}),
		);

		return NextResponse.json({ data }, { headers: adminHeaders() });
	});
}
