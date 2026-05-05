import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { adminRegradeTest } from "@/lib/admin/grading/regrade";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const r = await adminRegradeTest(id);
	if (!r.ok) return adminErrorResponse(r.message);

	// Strict audit: regrade rewrites the recorded assessment outcome.
	await writeAdminActionStrict({
		action: ADMIN_ACTIONS.TEST_REGRADE,
		targetType: "test",
		targetId: id,
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return adminAckResponse();
}
