import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminRecalculatePerformanceFromReports } from "@/lib/admin/performance-admin";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ studentId: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { studentId } = await ctx.params;
	const r = await adminRecalculatePerformanceFromReports(studentId);
	if (!r.ok) {
		return NextResponse.json({ error: r.message }, { status: 400, headers: adminHeaders() });
	}

	await writeAdminAction({
		action: "performance_recalculate",
		targetType: "student",
		targetId: studentId,
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ ok: true }, { headers: adminHeaders() });
}
