import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { quotaGrants } from "@/db/schema/billing";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ grantId: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { grantId } = await ctx.params;
		const uuid = z.string().uuid().safeParse(grantId);
		if (!uuid.success) {
			return adminErrorResponse("Invalid grant id");
		}

		const rows = await db.select().from(quotaGrants).where(eq(quotaGrants.id, uuid.data)).limit(1);
		const row = rows[0];
		if (!row) return adminErrorResponse("Not found", { status: 404 });

		if (row.consumed > 0) {
			return adminErrorResponse("Grant already partially consumed; refuse delete for accounting.", {
				status: 409,
			});
		}

		await db.delete(quotaGrants).where(and(eq(quotaGrants.id, uuid.data), eq(quotaGrants.consumed, 0)));

		// Strict audit on a quota-grant delete: the deletion is irreversible
		// (no soft-delete column on this table), and a missing audit row would
		// leave us unable to reconstruct who removed which student's grant.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.QUOTA_GRANT_DELETE,
			targetType: "quota_grant",
			targetId: uuid.data,
			payload: { student_id: row.studentId, grant_type: row.grantType, quantity: row.quantity },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
