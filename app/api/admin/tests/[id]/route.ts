import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminGetTestReport, adminLoadQuestionAnomalies } from "@/lib/admin/tests-admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const admin = createServiceRoleClient();

	const { data: test, error: tErr } = await admin.from("tests").select("*").eq("id", id).maybeSingle();
	if (tErr || !test) {
		return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
	}

	const { data: questions, error: qErr } = await admin
		.from("questions")
		.select("*")
		.eq("test_id", id)
		.order("question_number", { ascending: true });

	if (qErr) {
		return NextResponse.json({ error: qErr.message }, { status: 500, headers: adminHeaders() });
	}

	const { data: answers, error: aErr } = await admin.from("student_answers").select("*").eq("test_id", id);
	if (aErr) {
		return NextResponse.json({ error: aErr.message }, { status: 500, headers: adminHeaders() });
	}

	const qAnomalies = await adminLoadQuestionAnomalies(id);
	const report = await adminGetTestReport(id);

	return NextResponse.json(
		{ test, questions: questions ?? [], answers: answers ?? [], question_anomalies: qAnomalies, report },
		{ headers: adminHeaders() },
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

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500, headers: adminHeaders() });
	}

	await writeAdminAction({
		action: "test_soft_delete",
		targetType: "test",
		targetId: id,
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ ok: true }, { headers: adminHeaders() });
}
