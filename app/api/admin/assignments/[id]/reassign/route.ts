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

const bodySchema = z.object({
	teacher_id: z.string().uuid().optional(),
	target_grades: z.array(z.number().int()).optional(),
	target_sections: z.array(z.string().max(5)).optional(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
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
	const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
	if (parsed.data.teacher_id) patch.teacher_id = parsed.data.teacher_id;
	if (parsed.data.target_grades) patch.target_grades = parsed.data.target_grades;
	if (parsed.data.target_sections) patch.target_sections = parsed.data.target_sections;

	const { error } = await admin.from("assignments").update(patch).eq("id", id);
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500, headers: adminHeaders() });
	}

	await writeAdminAction({
		action: "assignment_reassign",
		targetType: "assignment",
		targetId: id,
		payload: patch,
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ ok: true }, { headers: adminHeaders() });
}
