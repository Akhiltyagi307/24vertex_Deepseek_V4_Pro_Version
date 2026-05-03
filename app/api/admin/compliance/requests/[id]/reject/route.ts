import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { rejectComplianceRequestBodySchema } from "@/lib/compliance/schemas";
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
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
	}
	const parsed = rejectComplianceRequestBodySchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
	}

	const [existing] = await db.select().from(complianceRequests).where(eq(complianceRequests.id, uuid.data)).limit(1);
	if (!existing) {
		return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
	}
	if (existing.status === "fulfilled") {
		return NextResponse.json({ error: "Cannot reject a fulfilled request" }, { status: 409, headers: adminHeaders() });
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

	await writeAdminAction({
		action: "compliance_request_rejected",
		targetType: "compliance_request",
		targetId: uuid.data,
		payload: { reason: parsed.data.reason },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ data: updated }, { headers: adminHeaders() });
}
