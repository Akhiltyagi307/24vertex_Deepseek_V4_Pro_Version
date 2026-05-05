import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { adminReinitializePerformanceTracker } from "@/lib/admin/performance-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ studentId: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { studentId } = await ctx.params;
	const r = await adminReinitializePerformanceTracker(studentId);
	if (!r.ok) return adminErrorResponse(r.message);

	await writeAdminAction({
		action: ADMIN_ACTIONS.PERFORMANCE_REINITIALIZE,
		targetType: "student",
		targetId: studentId,
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return adminAckResponse();
}
