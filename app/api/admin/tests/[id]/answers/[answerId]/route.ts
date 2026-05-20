import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const patchSchema = z.object({
	score_earned: z.string().max(20),
	reason: z.string().max(2000).optional(),
}).strict();

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; answerId: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id: testId, answerId } = await ctx.params;
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return adminErrorResponse("Invalid JSON");
	}
	const parsed = patchSchema.safeParse(json);
	if (!parsed.success) return adminErrorResponse("Invalid body");

	const admin = createServiceRoleClient();
	const { error } = await admin
		.from("student_answers")
		.update({
			score_earned: parsed.data.score_earned,
			updated_at: new Date().toISOString(),
		})
		.eq("id", answerId)
		.eq("test_id", testId);

	if (error) return adminErrorResponse(error.message, { status: 500 });

	// Strict audit: per-answer score override is a direct grade manipulation.
	await writeAdminActionStrict({
		action: ADMIN_ACTIONS.TEST_ANSWER_OVERRIDE_SCORE,
		targetType: "student_answer",
		targetId: answerId,
		payload: { test_id: testId, score_earned: parsed.data.score_earned, reason: parsed.data.reason ?? null },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return adminAckResponse();
}
