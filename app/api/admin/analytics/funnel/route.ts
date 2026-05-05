import { NextResponse } from "next/server";

import { getAdminAnalyticsFunnelData } from "@/lib/admin/analytics/funnel-data";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_RESPONSE_HEADERS, adminErrorResponse } from "@/lib/admin/response";

export const runtime = "nodejs";

export async function GET() {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	try {
		const { stages, events_90d } = await getAdminAnalyticsFunnelData();
		return NextResponse.json({ stages, events_90d }, { headers: { ...ADMIN_RESPONSE_HEADERS } });
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Internal error";
		return adminErrorResponse(msg, { status: 500 });
	}
}
