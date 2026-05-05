import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
	minutes: z.number().int().min(1).max(180),
});

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
	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) return adminErrorResponse("Invalid body");

	const admin = createServiceRoleClient();
	const { data: row, error: gErr } = await admin
		.from("tests")
		.select("time_limit_seconds, admin_extensions")
		.eq("id", id)
		.maybeSingle();
	if (gErr || !row) return adminErrorResponse("Not found", { status: 404 });

	const addSec = parsed.data.minutes * 60;
	const nextLimit = (row.time_limit_seconds ?? 3600) + addSec;
	const nextExt = (row.admin_extensions ?? 0) + 1;

	const { error } = await admin
		.from("tests")
		.update({
			time_limit_seconds: nextLimit,
			admin_extensions: nextExt,
			updated_at: new Date().toISOString(),
		})
		.eq("id", id);

	if (error) return adminErrorResponse(error.message, { status: 500 });

	await writeAdminAction({
		action: ADMIN_ACTIONS.TEST_EXTEND_TIMER,
		targetType: "test",
		targetId: id,
		payload: { minutes: parsed.data.minutes, new_time_limit_seconds: nextLimit },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return adminAckResponse({ time_limit_seconds: nextLimit });
}
