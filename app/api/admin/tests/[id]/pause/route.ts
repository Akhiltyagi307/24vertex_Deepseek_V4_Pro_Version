import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const admin = createServiceRoleClient();
	const now = new Date().toISOString();

	const { error } = await admin
		.from("tests")
		.update({
			is_paused: true,
			paused_at: now,
			updated_at: now,
		})
		.eq("id", id);

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500, headers: adminHeaders() });
	}

	await writeAdminAction({
		action: "test_pause",
		targetType: "test",
		targetId: id,
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ ok: true }, { headers: adminHeaders() });
}
