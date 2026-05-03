import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { verifyAdminTotpIfConfigured } from "@/lib/admin/auth";
import { isAdminTotpRequired } from "@/lib/admin/feature-flags";
import { performComplianceErasure } from "@/lib/compliance/erasure";
import { eraseBodySchema } from "@/lib/compliance/schemas";
import { db } from "@/db";
import { complianceRequests } from "@/db/schema/compliance-requests";

export const runtime = "nodejs";
export const maxDuration = 120;

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
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
	}
	const parsed = eraseBodySchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
	}

	const idempotencyKey = request.headers.get("idempotency-key")?.trim() || parsed.data.idempotency_key || randomUUID();

	const [reqRow] = await db.select().from(complianceRequests).where(eq(complianceRequests.id, uuid.data)).limit(1);
	if (!reqRow) {
		return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
	}
	if (reqRow.requestType !== "erasure") {
		return NextResponse.json({ error: "Erasure only applies to erasure-type requests" }, { status: 409, headers: adminHeaders() });
	}
	if (!reqRow.identityVerified) {
		return NextResponse.json({ error: "Identity must be verified before erasure" }, { status: 409, headers: adminHeaders() });
	}
	if (!reqRow.subjectUserId) {
		return NextResponse.json({ error: "subject_user_id is required" }, { status: 409, headers: adminHeaders() });
	}
	if (reqRow.status === "fulfilled" && !parsed.data.dry_run) {
		return NextResponse.json({ error: "Request already fulfilled" }, { status: 409, headers: adminHeaders() });
	}

	const totpRequired = await isAdminTotpRequired();
	if (totpRequired && !verifyAdminTotpIfConfigured(parsed.data.totp)) {
		return NextResponse.json({ error: "TOTP required" }, { status: 401, headers: adminHeaders() });
	}

	const subjectUserId = reqRow.subjectUserId;

	await writeAdminAction({
		action: parsed.data.dry_run ? "compliance_erasure_dry_run" : "compliance_erasure_commit",
		targetType: "compliance_request",
		targetId: uuid.data,
		payload: { subject_user_id: subjectUserId, idempotency_key: idempotencyKey },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
		totpUsed: totpRequired,
	});

	const counts = await performComplianceErasure(subjectUserId, { dryRun: parsed.data.dry_run });

	if (!parsed.data.dry_run) {
		await db
			.update(complianceRequests)
			.set({
				status: "fulfilled",
				fulfilledAt: new Date(),
				evidenceUrl: JSON.stringify({ type: "erasure", counts, idempotency_key: idempotencyKey }),
			})
			.where(eq(complianceRequests.id, uuid.data));
	}

	return NextResponse.json({ dry_run: parsed.data.dry_run, counts }, { headers: adminHeaders() });
}
