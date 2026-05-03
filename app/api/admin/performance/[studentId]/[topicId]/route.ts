import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

const patchSchema = z.object({
	status: z.string().max(20).optional(),
	average_score: z.string().max(20).optional(),
	tests_taken: z.number().int().min(0).optional(),
	trend: z.string().max(20).optional(),
	reason: z.string().max(2000).optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ studentId: string; topicId: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { studentId, topicId } = await ctx.params;
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
	}
	const parsed = patchSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: adminHeaders() });
	}

	const admin = createServiceRoleClient();
	const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
	if (parsed.data.status != null) patch.status = parsed.data.status;
	if (parsed.data.average_score != null) patch.average_score = parsed.data.average_score;
	if (parsed.data.tests_taken != null) patch.tests_taken = parsed.data.tests_taken;
	if (parsed.data.trend != null) patch.trend = parsed.data.trend;

	const { error } = await admin
		.from("performance_tracker")
		.update(patch)
		.eq("student_id", studentId)
		.eq("topic_id", topicId);

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500, headers: adminHeaders() });
	}

	await writeAdminAction({
		action: "performance_tracker_patch",
		targetType: "performance_tracker",
		targetId: `${studentId}:${topicId}`,
		payload: { ...patch, reason: parsed.data.reason ?? null },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ ok: true }, { headers: adminHeaders() });
}
