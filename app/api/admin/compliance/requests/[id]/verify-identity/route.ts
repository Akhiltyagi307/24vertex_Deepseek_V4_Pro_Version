import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { recordComplianceEvent } from "@/lib/compliance/events";
import { verifyIdentityBodySchema } from "@/lib/compliance/schemas";
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
		body = {};
	}
	const parsed = verifyIdentityBodySchema.safeParse(body);
	if (!parsed.success) {
		await recordComplianceEvent({
			requestId: uuid.data,
			phase: "identity_verification",
			status: "failed",
			errorMessage: "validation_failed",
		});
		return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
	}

	const [existing] = await db.select().from(complianceRequests).where(eq(complianceRequests.id, uuid.data)).limit(1);
	if (!existing) return adminErrorResponse("Not found", { status: 404 });

	const [updated] = await db
		.update(complianceRequests)
		.set({
			identityVerified: true,
			evidenceUrl: parsed.data.evidence_url ?? existing.evidenceUrl,
			status: existing.status === "open" ? "in_progress" : existing.status,
		})
		.where(eq(complianceRequests.id, uuid.data))
		.returning();

	// Strict audit: identity-verified is the gating step before erasure /
	// export — must always be attributable in the compliance chain.
	await writeAdminActionStrict({
		action: ADMIN_ACTIONS.COMPLIANCE_IDENTITY_VERIFIED,
		targetType: "compliance_request",
		targetId: uuid.data,
		payload: { evidence_url: parsed.data.evidence_url ?? null },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});
	await recordComplianceEvent({
		requestId: uuid.data,
		phase: "identity_verification",
		status: "ok",
		payload: { evidence_url: parsed.data.evidence_url ?? null },
	});

	return adminDetailResponse(updated);
}
