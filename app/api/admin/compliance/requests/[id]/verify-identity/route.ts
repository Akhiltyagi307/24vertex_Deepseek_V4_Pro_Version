import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { recordComplianceEvent } from "@/lib/compliance/events";
import { verifyIdentityBodySchema } from "@/lib/compliance/schemas";
import { db } from "@/db";
import { complianceRequests } from "@/db/schema/compliance-requests";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const uuid = z.string().uuid().safeParse(id);
	if (!uuid.success) {
		return NextResponse.json({ error: "Invalid id" }, { status: 400, headers: adminHeaders() });
	}

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
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
	}

	const [existing] = await db.select().from(complianceRequests).where(eq(complianceRequests.id, uuid.data)).limit(1);
	if (!existing) {
		return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
	}

	const [updated] = await db
		.update(complianceRequests)
		.set({
			identityVerified: true,
			evidenceUrl: parsed.data.evidence_url ?? existing.evidenceUrl,
			status: existing.status === "open" ? "in_progress" : existing.status,
		})
		.where(eq(complianceRequests.id, uuid.data))
		.returning();

	await writeAdminAction({
		action: "compliance_identity_verified",
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

	return NextResponse.json({ data: updated }, { headers: adminHeaders() });
}
