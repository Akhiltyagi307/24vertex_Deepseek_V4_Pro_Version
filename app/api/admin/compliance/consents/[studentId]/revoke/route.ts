import { and, desc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { parentalConsents } from "@/db/schema/parental-consents";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ studentId: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { studentId } = await ctx.params;
	const uuid = z.string().uuid().safeParse(studentId);
	if (!uuid.success) return adminErrorResponse("Invalid student id");

	const [latest] = await db
		.select()
		.from(parentalConsents)
		.where(and(eq(parentalConsents.studentId, uuid.data), isNull(parentalConsents.revokedAt)))
		.orderBy(desc(parentalConsents.grantedAt))
		.limit(1);

	if (!latest) return adminErrorResponse("No active consent row to revoke", { status: 404 });

	const now = new Date();
	const [updated] = await db
		.update(parentalConsents)
		.set({ revokedAt: now })
		.where(eq(parentalConsents.id, latest.id))
		.returning();

	// Strict audit: parental consent withdrawal is a high-stakes compliance
	// state change with downstream effects on what the student account can do.
	await writeAdminActionStrict({
		action: ADMIN_ACTIONS.PARENTAL_CONSENT_REVOKED,
		targetType: "parental_consent",
		targetId: latest.id,
		payload: { student_id: uuid.data },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return adminDetailResponse(updated);
}
