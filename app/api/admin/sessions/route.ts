import { desc, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_RESPONSE_HEADERS } from "@/lib/admin/response";
import { db } from "@/db";
import { adminSessions } from "@/db/schema/admin-sessions";

export const runtime = "nodejs";

export async function GET() {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const rows = await db
			.select({
				id: adminSessions.id,
				jwtId: adminSessions.jwtId,
				ipAddress: adminSessions.ipAddress,
				userAgent: adminSessions.userAgent,
				totpUsed: adminSessions.totpUsed,
				createdAt: adminSessions.createdAt,
				lastSeenAt: adminSessions.lastSeenAt,
			})
			.from(adminSessions)
			.where(isNull(adminSessions.revokedAt))
			.orderBy(desc(adminSessions.lastSeenAt));

		const data = rows.map((r) => ({
			id: r.id,
			jwt_id: r.jwtId,
			ip_address: r.ipAddress == null ? null : String(r.ipAddress),
			user_agent: r.userAgent,
			totp_used: r.totpUsed ?? false,
			created_at: r.createdAt?.toISOString() ?? null,
			last_seen_at: r.lastSeenAt?.toISOString() ?? null,
			is_current: r.jwtId === gate.jti,
		}));

		// `{ data }` shape (no totals — admin sessions are a small list).
		return NextResponse.json({ data }, { headers: { ...ADMIN_RESPONSE_HEADERS } });
	});
}
