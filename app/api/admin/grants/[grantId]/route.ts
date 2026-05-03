import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { db } from "@/db";
import { quotaGrants } from "@/db/schema/billing";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ grantId: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { grantId } = await ctx.params;
		const uuid = z.string().uuid().safeParse(grantId);
		if (!uuid.success) {
			return NextResponse.json({ error: "Invalid grant id" }, { status: 400, headers: adminHeaders() });
		}

		const rows = await db.select().from(quotaGrants).where(eq(quotaGrants.id, uuid.data)).limit(1);
		const row = rows[0];
		if (!row) return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });

		if (row.consumed > 0) {
			return NextResponse.json(
				{ error: "Grant already partially consumed; refuse delete for accounting." },
				{ status: 409, headers: adminHeaders() },
			);
		}

		await db.delete(quotaGrants).where(and(eq(quotaGrants.id, uuid.data), eq(quotaGrants.consumed, 0)));

		await writeAdminAction({
			action: "quota_grant_delete",
			targetType: "quota_grant",
			targetId: uuid.data,
			payload: { student_id: row.studentId, grant_type: row.grantType, quantity: row.quantity },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
