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
	refund_credit: z.boolean().optional(),
	refund_reason: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id: testId } = await ctx.params;
	let json: unknown = {};
	try {
		json = await request.json();
	} catch {
		json = {};
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

	if (parsed.data.refund_credit) {
		const reason = parsed.data.refund_reason?.trim() || "void_test_refund";
		const refund = await adminRefundTestCredit({
			profileId: test.student_id as string,
			testId,
			reason,
			idempotencyKey: randomUUID(),
		});
		if (!refund.ok && refund.code !== "nothing_to_refund") {
			return NextResponse.json({ error: refund.message }, { status: 500, headers: adminHeaders() });
		}
	}

	const now = new Date().toISOString();
	const { error } = await admin
		.from("tests")
		.update({
			status: "expired",
			abandoned_at: now,
			is_paused: false,
			updated_at: now,
		})
		.eq("id", testId);

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500, headers: adminHeaders() });
	}

	await writeAdminAction({
		action: "test_void",
		targetType: "test",
		targetId: testId,
		payload: { refund_credit: Boolean(parsed.data.refund_credit) },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ ok: true }, { headers: adminHeaders() });
}
