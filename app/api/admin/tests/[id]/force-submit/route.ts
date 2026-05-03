import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { executePracticeTestSubmit } from "@/lib/practice/submit-practice-shared";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

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
	if (tErr || !test) {
		return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
	}
	if (test.status !== "in_progress") {
		return NextResponse.json({ error: "Test is not in progress." }, { status: 400, headers: adminHeaders() });
	}

	const elapsed = typeof test.duration_seconds === "number" ? test.duration_seconds : 0;
	const result = await executePracticeTestSubmit(admin, test.student_id as string, testId, elapsed);
	if (!result.ok) {
		return NextResponse.json({ error: result.message }, { status: 500, headers: adminHeaders() });
	}

	await writeAdminAction({
		action: "test_force_submit",
		targetType: "test",
		targetId: testId,
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ ok: true, redirectTo: result.redirectTo }, { headers: adminHeaders() });
}
