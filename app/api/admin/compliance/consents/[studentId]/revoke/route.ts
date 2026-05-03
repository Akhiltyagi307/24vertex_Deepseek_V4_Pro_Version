import { and, desc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { db } from "@/db";
import { parentalConsents } from "@/db/schema/parental-consents";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ studentId: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { studentId } = await ctx.params;
	const uuid = z.string().uuid().safeParse(studentId);
	if (!uuid.success) {
		return NextResponse.json({ error: "Invalid student id" }, { status: 400, headers: adminHeaders() });
	}

	const [latest] = await db
		.select()
		.from(parentalConsents)
		.where(and(eq(parentalConsents.studentId, uuid.data), isNull(parentalConsents.revokedAt)))
		.orderBy(desc(parentalConsents.grantedAt))
		.limit(1);

	if (!latest) {
		return NextResponse.json({ error: "No active consent row to revoke" }, { status: 404, headers: adminHeaders() });
	}

	const now = new Date();
	const [updated] = await db
		.update(parentalConsents)
		.set({ revokedAt: now })
		.where(eq(parentalConsents.id, latest.id))
		.returning();

	await writeAdminAction({
		action: "parental_consent_revoked",
		targetType: "parental_consent",
		targetId: latest.id,
		payload: { student_id: uuid.data },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ data: updated }, { headers: adminHeaders() });
}
