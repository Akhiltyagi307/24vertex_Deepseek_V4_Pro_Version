import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";
import { emailLog } from "@/db/schema/comms-audit";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const [row] = await db.select().from(emailLog).where(eq(emailLog.id, id)).limit(1);
	if (!row) {
		return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
	}
	return NextResponse.json({ data: row }, { headers: adminHeaders() });
}
