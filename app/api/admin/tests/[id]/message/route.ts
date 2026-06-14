import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminAckResponse, adminErrorResponse, adminInternalErrorResponse } from "@/lib/admin/response";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
	body: z.string().min(1).max(2000),
}).strict();

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
	const { error } = await admin.from("admin_test_messages").insert({
		test_id: id,
		body: parsed.data.body,
	});

	if (error) return adminInternalErrorResponse(error, { code: "test_admin_message_failed" });

	await writeAdminAction({
		action: ADMIN_ACTIONS.TEST_ADMIN_MESSAGE,
		targetType: "test",
		targetId: id,
		payload: { preview: parsed.data.body.slice(0, 120) },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return adminAckResponse();
}
