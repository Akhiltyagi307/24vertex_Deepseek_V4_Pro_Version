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
	score_earned: z.string().max(20),
	reason: z.string().max(2000).optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; answerId: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id: testId, answerId } = await ctx.params;
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
	const { error } = await admin
		.from("student_answers")
		.update({
			score_earned: parsed.data.score_earned,
			updated_at: new Date().toISOString(),
		})
		.eq("id", answerId)
		.eq("test_id", testId);

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500, headers: adminHeaders() });
	}

	await writeAdminAction({
		action: "test_answer_override_score",
		targetType: "student_answer",
		targetId: answerId,
		payload: { test_id: testId, score_earned: parsed.data.score_earned, reason: parsed.data.reason ?? null },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ ok: true }, { headers: adminHeaders() });
}
