import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { emailLog } from "@/db/schema/comms-audit";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const [row] = await db.select().from(emailLog).where(eq(emailLog.id, id)).limit(1);
	if (!row) return adminErrorResponse("Not found", { status: 404 });
	return adminDetailResponse(row);
}
