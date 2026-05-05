import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { patchRetentionBodySchema } from "@/lib/compliance/schemas";
import { db } from "@/db";
import { retentionPolicies } from "@/db/schema/retention-policies";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { entity: rawEntity } = await ctx.params;
	const entity = decodeURIComponent(rawEntity).slice(0, 100);
	if (!entity) return adminErrorResponse("Invalid entity");

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return adminErrorResponse("Invalid JSON");
	}
	const parsed = patchRetentionBodySchema.safeParse(body);
	if (!parsed.success) {
		return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
	}
	if (parsed.data.ttl_days === undefined && parsed.data.enabled === undefined) {
		return adminErrorResponse("Nothing to update");
	}

	const patch: { ttlDays?: number; enabled?: boolean } = {};
	if (parsed.data.ttl_days !== undefined) patch.ttlDays = parsed.data.ttl_days;
	if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;

	const [updated] = await db.update(retentionPolicies).set(patch).where(eq(retentionPolicies.entity, entity)).returning();
	if (!updated) return adminErrorResponse("Unknown entity", { status: 404 });

	// Strict audit: retention policy changes alter how long PII is kept —
	// compliance config change with downstream effect on every purge run.
	await writeAdminActionStrict({
		action: ADMIN_ACTIONS.RETENTION_POLICY_UPDATED,
		targetType: "retention_policy",
		targetId: entity,
		payload: patch,
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return adminDetailResponse(updated);
}
