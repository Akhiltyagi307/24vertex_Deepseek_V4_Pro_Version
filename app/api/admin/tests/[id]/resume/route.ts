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

	const { data: row, error: gErr } = await admin
		.from("tests")
		.select("paused_at, accumulated_pause_seconds")
		.eq("id", id)
		.maybeSingle();
	if (gErr || !row) {
		return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
	}

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

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500, headers: adminHeaders() });
	}

	await writeAdminAction({
		action: "test_resume",
		targetType: "test",
		targetId: id,
		payload: { accumulated_pause_seconds: acc + extraPause },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ ok: true, accumulated_pause_seconds: acc + extraPause }, { headers: adminHeaders() });
}
