import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminRefundTestCredit } from "@/lib/admin/billing/test-refund";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

const bodySchema = z.object({
	reason: z.string().min(1).max(2000),
	amount: z.number().int().min(1).max(100).optional(),
	idempotency_key: z.string().uuid().optional(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id: testId } = await ctx.params;
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
	}
	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: adminHeaders() });
	}

	const admin = createServiceRoleClient();
	const { data: test, error: tErr } = await admin.from("tests").select("student_id").eq("id", testId).maybeSingle();
	if (tErr || !test?.student_id) {
		return NextResponse.json({ error: "Test not found" }, { status: 404, headers: adminHeaders() });
	}

	const idempotencyKey = parsed.data.idempotency_key ?? randomUUID();
	const refund = await adminRefundTestCredit({
		profileId: test.student_id as string,
		testId,
		amount: parsed.data.amount,
		reason: parsed.data.reason,
		idempotencyKey,
	});

	if (!refund.ok) {
		const status = refund.code === "nothing_to_refund" ? 400 : 500;
		return NextResponse.json({ error: refund.message, code: refund.code }, { status, headers: adminHeaders() });
	}

	await writeAdminAction({
		action: "test_refund_credit",
		targetType: "test",
		targetId: testId,
		payload: { reason: parsed.data.reason, deduped: refund.deduped, idempotency_key: idempotencyKey },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ ok: true, deduped: refund.deduped }, { headers: adminHeaders() });
}
