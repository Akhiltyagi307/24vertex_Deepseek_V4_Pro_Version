import { and, eq, isNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { clientIpFromHeaders } from "@/lib/admin/api-request-meta";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { revokeAdminSessionByJti } from "@/lib/admin/login-core";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { adminSessions } from "@/db/schema/admin-sessions";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const ip = clientIpFromHeaders(request.headers);

		const rows = await db
			.select({
				id: adminSessions.id,
				jwtId: adminSessions.jwtId,
			})
			.from(adminSessions)
			.where(and(eq(adminSessions.id, id), isNull(adminSessions.revokedAt)))
			.limit(1);

		const row = rows[0];
		if (!row) {
			return adminErrorResponse("Session not found or already revoked", { status: 404 });
		}
		if (row.jwtId === gate.jti) {
			return adminErrorResponse("Cannot revoke the current session from here. Use Sign out instead.");
		}

		// Strict audit: revoking another admin's active session is destructive
		// and requires a durable record for incident review.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.ADMIN_SESSION_REVOKE,
			targetType: "admin_session",
			targetId: row.id,
			payload: { jwt_id_prefix: row.jwtId.slice(0, 8) },
			ipAddress: ip ?? undefined,
			userAgent: request.headers.get("user-agent"),
		});

		await revokeAdminSessionByJti(row.jwtId);

		return adminAckResponse();
	});
}
