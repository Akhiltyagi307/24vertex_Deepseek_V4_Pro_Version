import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminDetailResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { retentionPolicies } from "@/db/schema/retention-policies";

export const runtime = "nodejs";

export async function GET() {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const rows = await db.select().from(retentionPolicies).orderBy(asc(retentionPolicies.entity));
	return adminDetailResponse(rows);
}
