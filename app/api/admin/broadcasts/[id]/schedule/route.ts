import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { broadcasts } from "@/db/schema/broadcasts";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return adminErrorResponse("Invalid JSON");
	}
	const parsed = z.object({ scheduled_at: z.string().datetime() }).strict().safeParse(json);
	if (!parsed.success) {
		return adminErrorResponse("scheduled_at ISO datetime required");
	}

	const when = new Date(parsed.data.scheduled_at);
	if (when.getTime() <= Date.now()) {
		return adminErrorResponse("scheduled_at must be in the future");
	}

	await writeAdminAction({
		action: ADMIN_ACTIONS.BROADCAST_SCHEDULE,
		targetType: "broadcast",
		targetId: id,
		payload: { scheduled_at: when.toISOString() },
	});

	const [row] = await db
		.update(broadcasts)
		.set({ scheduledAt: when, status: "scheduled" })
		.where(eq(broadcasts.id, id))
		.returning();

	if (!row) return adminErrorResponse("Not found", { status: 404 });

	return adminDetailResponse(row);
}
