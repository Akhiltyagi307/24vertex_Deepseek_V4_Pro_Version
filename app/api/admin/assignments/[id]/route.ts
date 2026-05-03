import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { db } from "@/db";
import { assignments } from "@/db/schema/teaching";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const rows = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
	const row = rows[0];
	if (!row) {
		return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
	}
	return NextResponse.json({ data: row }, { headers: adminHeaders() });
}

const patchSchema = z.object({
	title: z.string().min(1).max(300).optional(),
	description: z.string().max(10_000).nullable().optional(),
	due_date: z.string().datetime().optional(),
	status: z.string().max(20).optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
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

	const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
	if (parsed.data.title != null) patch.title = parsed.data.title;
	if (parsed.data.description !== undefined) patch.description = parsed.data.description;
	if (parsed.data.due_date != null) patch.due_date = parsed.data.due_date;
	if (parsed.data.status != null) patch.status = parsed.data.status;

	const admin = createServiceRoleClient();
	const { error } = await admin.from("assignments").update(patch).eq("id", id);
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500, headers: adminHeaders() });
	}

	await writeAdminAction({
		action: "assignment_patch",
		targetType: "assignment",
		targetId: id,
		payload: patch,
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ ok: true }, { headers: adminHeaders() });
}
