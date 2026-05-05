import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { rejectComplianceRequestBodySchema } from "@/lib/compliance/schemas";
import { db } from "@/db";
import { complianceRequests } from "@/db/schema/compliance-requests";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const uuid = z.string().uuid().safeParse(id);
	if (!uuid.success) return adminErrorResponse("Invalid id");

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return adminErrorResponse("Invalid JSON");
	}
	const parsed = rejectComplianceRequestBodySchema.safeParse(body);
	if (!parsed.success) {
		return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
	}

	const [existing] = await db.select().from(complianceRequests).where(eq(complianceRequests.id, uuid.data)).limit(1);
	if (!existing) return adminErrorResponse("Not found", { status: 404 });
	if (existing.status === "fulfilled") {
		return adminErrorResponse("Cannot reject a fulfilled request", { status: 409 });
	}

	const noteAppend = `\n\n[rejected ${new Date().toISOString()}] ${parsed.data.reason}`;
	const mergedNotes = [existing.notes?.trim() ?? "", noteAppend.trim()].filter(Boolean).join("\n");

	const [updated] = await db
		.update(complianceRequests)
		.set({
			status: "rejected",
			notes: mergedNotes,
			fulfilledAt: new Date(),
		})
		.where(eq(complianceRequests.id, uuid.data))
		.returning();

	// Strict audit: rejecting a DSR is a final compliance state change.
	await writeAdminActionStrict({
		action: ADMIN_ACTIONS.COMPLIANCE_REQUEST_REJECTED,
		targetType: "compliance_request",
		targetId: uuid.data,
		payload: { reason: parsed.data.reason },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return adminDetailResponse(updated);
}
