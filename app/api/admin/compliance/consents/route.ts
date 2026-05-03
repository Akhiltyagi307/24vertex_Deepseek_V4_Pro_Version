import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";
import { parentalConsents } from "@/db/schema/parental-consents";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET() {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const rows = await db.select().from(parentalConsents).orderBy(desc(parentalConsents.grantedAt)).limit(2000);
	return NextResponse.json({ data: rows }, { headers: adminHeaders() });
}
