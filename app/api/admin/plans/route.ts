import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_RESPONSE_HEADERS } from "@/lib/admin/response";
import { db } from "@/db";
import { plans } from "@/db/schema/billing";

export const runtime = "nodejs";

export async function GET() {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const rows = await db.select().from(plans).orderBy(asc(plans.sortOrder), asc(plans.code));

		// `{ data: rows }` is the existing client shape — there's no client-side
		// pagination on the plans page, so wrapping in `adminListResponse` would
		// add `total/page/page_size` fields the client doesn't read.
		return NextResponse.json({ data: rows }, { headers: { ...ADMIN_RESPONSE_HEADERS } });
	});
}
