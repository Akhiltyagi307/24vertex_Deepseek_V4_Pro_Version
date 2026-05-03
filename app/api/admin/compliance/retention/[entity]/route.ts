import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { patchRetentionBodySchema } from "@/lib/compliance/schemas";
import { db } from "@/db";
import { retentionPolicies } from "@/db/schema/retention-policies";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { entity: rawEntity } = await ctx.params;
	const entity = decodeURIComponent(rawEntity).slice(0, 100);
	if (!entity) {
		return NextResponse.json({ error: "Invalid entity" }, { status: 400, headers: adminHeaders() });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
	}
	const parsed = patchRetentionBodySchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
	}
	if (parsed.data.ttl_days === undefined && parsed.data.enabled === undefined) {
		return NextResponse.json({ error: "Nothing to update" }, { status: 400, headers: adminHeaders() });
	}

	const patch: { ttlDays?: number; enabled?: boolean } = {};
	if (parsed.data.ttl_days !== undefined) patch.ttlDays = parsed.data.ttl_days;
	if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;

	const [updated] = await db.update(retentionPolicies).set(patch).where(eq(retentionPolicies.entity, entity)).returning();
	if (!updated) {
		return NextResponse.json({ error: "Unknown entity" }, { status: 404, headers: adminHeaders() });
	}

	await writeAdminAction({
		action: "retention_policy_updated",
		targetType: "retention_policy",
		targetId: entity,
		payload: patch,
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ data: updated }, { headers: adminHeaders() });
}
