import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { adminRecalculatePerformanceFromReports } from "@/lib/admin/performance-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ studentId: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { studentId } = await ctx.params;
	const r = await adminRecalculatePerformanceFromReports(studentId);
	if (!r.ok) return adminErrorResponse(r.message);

	await writeAdminAction({
		action: ADMIN_ACTIONS.PERFORMANCE_RECALCULATE,
		targetType: "student",
		targetId: studentId,
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return adminAckResponse();
}
