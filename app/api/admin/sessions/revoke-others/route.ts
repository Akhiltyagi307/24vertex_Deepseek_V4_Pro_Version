import { and, isNull, ne } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromHeaders } from "@/lib/admin/api-request-meta";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";
import { adminSessions } from "@/db/schema/admin-sessions";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { jti } = gate;
		const ip = clientIpFromHeaders(request.headers);

		await writeAdminAction({
			action: "admin_sessions_revoke_others",
			payload: { scope: "all_except_current" },
			ipAddress: ip ?? undefined,
			userAgent: request.headers.get("user-agent"),
		});

		await db
			.update(adminSessions)
			.set({ revokedAt: new Date() })
			.where(and(ne(adminSessions.jwtId, jti), isNull(adminSessions.revokedAt)));

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
