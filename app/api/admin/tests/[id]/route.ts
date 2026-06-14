import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_RESPONSE_HEADERS, adminAckResponse, adminErrorResponse, adminInternalErrorResponse } from "@/lib/admin/response";
import { adminGetTestReport, adminLoadQuestionAnomalies } from "@/lib/admin/tests-admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const admin = createServiceRoleClient();

	const { data: test, error: tErr } = await admin.from("tests").select("*").eq("id", id).maybeSingle();
	if (tErr || !test) return adminErrorResponse("Not found", { status: 404 });

	const { data: questions, error: qErr } = await admin
		.from("questions")
		.select("*")
		.eq("test_id", id)
		.order("question_number", { ascending: true });

	if (qErr) return adminInternalErrorResponse(qErr, { code: "tests_questions_query_failed" });

	const { data: answers, error: aErr } = await admin.from("student_answers").select("*").eq("test_id", id);
	if (aErr) return adminInternalErrorResponse(aErr, { code: "tests_answers_query_failed" });

	const qAnomalies = await adminLoadQuestionAnomalies(id);
	const report = await adminGetTestReport(id);

	// Multi-section response (test + questions + answers + anomalies + report)
	// — keep client contract.
	return NextResponse.json(
		{ test, questions: questions ?? [], answers: answers ?? [], question_anomalies: qAnomalies, report },
		{ headers: { ...ADMIN_RESPONSE_HEADERS } },
	);
}

/** Soft-delete / void-style: mark expired (PDR-aligned). */
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const admin = createServiceRoleClient();

	const { error } = await admin
		.from("tests")
		.update({
			status: "expired",
			abandoned_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})
		.eq("id", id);

	if (error) return adminInternalErrorResponse(error, { code: "test_soft_delete_failed" });

	// Strict audit: high-stakes assessment override (the test is now expired
	// from the student's perspective).
	await writeAdminActionStrict({
		action: ADMIN_ACTIONS.TEST_SOFT_DELETE,
		targetType: "test",
		targetId: id,
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return adminAckResponse();
}
