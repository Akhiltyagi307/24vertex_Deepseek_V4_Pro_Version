import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { executePracticeTestSubmit } from "@/lib/practice/submit-practice-shared";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id: testId } = await ctx.params;
	const admin = createServiceRoleClient();

	const { data: test, error: tErr } = await admin
		.from("tests")
		.select("student_id, status, duration_seconds")
		.eq("id", testId)
		.maybeSingle();
	if (tErr || !test) return adminErrorResponse("Not found", { status: 404 });
	if (test.status !== "in_progress") return adminErrorResponse("Test is not in progress.");

	const elapsed = typeof test.duration_seconds === "number" ? test.duration_seconds : 0;
	const result = await executePracticeTestSubmit(admin, test.student_id as string, testId, elapsed);
	if (!result.ok) return adminErrorResponse(result.message, { status: 500 });

	// Strict audit: high-stakes assessment override (forced submission ends
	// the student's attempt and locks the score).
	await writeAdminActionStrict({
		action: ADMIN_ACTIONS.TEST_FORCE_SUBMIT,
		targetType: "test",
		targetId: testId,
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return adminAckResponse({ redirectTo: result.redirectTo });
}
