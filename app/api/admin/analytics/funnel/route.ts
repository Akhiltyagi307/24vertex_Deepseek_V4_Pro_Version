import { NextResponse } from "next/server";

import { getAdminAnalyticsFunnelData } from "@/lib/admin/analytics/funnel-data";
import { requireAdminApi } from "@/lib/admin/api-auth";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET() {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { stages, events_90d } = await getAdminAnalyticsFunnelData();
	return NextResponse.json({ stages, events_90d }, { headers: adminHeaders() });
}
