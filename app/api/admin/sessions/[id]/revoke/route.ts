import { and, eq, isNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromHeaders } from "@/lib/admin/api-request-meta";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { revokeAdminSessionByJti } from "@/lib/admin/login-core";
import { db } from "@/db";
import { adminSessions } from "@/db/schema/admin-sessions";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

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
			return NextResponse.json({ error: "Session not found or already revoked" }, { status: 404, headers: adminHeaders() });
		}
		if (row.jwtId === gate.jti) {
			return NextResponse.json(
				{ error: "Cannot revoke the current session from here. Use Sign out instead." },
				{ status: 400, headers: adminHeaders() },
			);
		}

		await writeAdminAction({
			action: "admin_session_revoke",
			targetType: "admin_session",
			targetId: row.id,
			payload: { jwt_id_prefix: row.jwtId.slice(0, 8) },
			ipAddress: ip ?? undefined,
			userAgent: request.headers.get("user-agent"),
		});

		await revokeAdminSessionByJti(row.jwtId);

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
