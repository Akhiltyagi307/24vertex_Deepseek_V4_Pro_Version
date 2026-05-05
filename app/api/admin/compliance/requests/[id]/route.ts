import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { complianceRequests } from "@/db/schema/compliance-requests";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const uuid = z.string().uuid().safeParse(id);
	if (!uuid.success) return adminErrorResponse("Invalid id");

	const [row] = await db.select().from(complianceRequests).where(eq(complianceRequests.id, uuid.data)).limit(1);
	if (!row) return adminErrorResponse("Not found", { status: 404 });

	return adminDetailResponse(row);
}
