import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminAckResponse, adminErrorResponse, adminInternalErrorResponse } from "@/lib/admin/response";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const admin = createServiceRoleClient();

	const { data: row, error: gErr } = await admin
		.from("tests")
		.select("paused_at, accumulated_pause_seconds")
		.eq("id", id)
		.maybeSingle();
	if (gErr || !row) return adminErrorResponse("Not found", { status: 404 });

	let extraPause = 0;
	if (row.paused_at) {
		extraPause = Math.max(
			0,
			Math.floor((Date.now() - new Date(row.paused_at as string).getTime()) / 1000),
		);
	}
	const acc = (row.accumulated_pause_seconds as number | null) ?? 0;

	const now = new Date().toISOString();
	const { error } = await admin
		.from("tests")
		.update({
			is_paused: false,
			paused_at: null,
			accumulated_pause_seconds: acc + extraPause,
			updated_at: now,
		})
		.eq("id", id);

	if (error) return adminInternalErrorResponse(error, { code: "test_resume_failed" });

	await writeAdminAction({
		action: ADMIN_ACTIONS.TEST_RESUME,
		targetType: "test",
		targetId: id,
		payload: { accumulated_pause_seconds: acc + extraPause },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return adminAckResponse({ accumulated_pause_seconds: acc + extraPause });
}
