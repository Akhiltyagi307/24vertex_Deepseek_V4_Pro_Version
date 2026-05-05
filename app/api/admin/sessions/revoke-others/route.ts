import { and, isNull, ne } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { clientIpFromHeaders } from "@/lib/admin/api-request-meta";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminAckResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { adminSessions } from "@/db/schema/admin-sessions";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { jti } = gate;
		const ip = clientIpFromHeaders(request.headers);

		// Strict audit: bulk-revoking other admin sessions is a high-stakes
		// operator action — a missing audit row would make incident response
		// (who revoked sessions, when?) impossible.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.ADMIN_SESSIONS_REVOKE_OTHERS,
			payload: { scope: "all_except_current" },
			ipAddress: ip ?? undefined,
			userAgent: request.headers.get("user-agent"),
		});

		await db
			.update(adminSessions)
			.set({ revokedAt: new Date() })
			.where(and(ne(adminSessions.jwtId, jti), isNull(adminSessions.revokedAt)));

		return adminAckResponse();
	});
}
