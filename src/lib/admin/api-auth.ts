import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import * as Sentry from "@sentry/nextjs";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { clientIpFromHeaders } from "@/lib/admin/api-request-meta";
import { verifyAdminJwt } from "@/lib/admin/auth";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/constants";
import { isAdminIpAllowed } from "@/lib/admin/ip-allowlist";
import { isPostgresTooManyConnectionsError } from "@/lib/db/postgres-errors";
import { db } from "@/db";
import { adminSessions } from "@/db/schema/admin-sessions";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function requireAdminApi(): Promise<{ jti: string } | NextResponse> {
	const jar = await cookies();
	const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
	if (!token) {
		return NextResponse.json({ error: "Unauthorized", code: "admin_unauthorized" }, { status: 401, headers: adminHeaders() });
	}
	const payload = await verifyAdminJwt(token);
	if (!payload) {
		return NextResponse.json({ error: "Unauthorized", code: "admin_invalid_token" }, { status: 401, headers: adminHeaders() });
	}
	if (!isAdminIpAllowed(clientIpFromHeaders(await headers()))) {
		return NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403, headers: adminHeaders() });
	}
	try {
		const rows = await db
			.select({ id: adminSessions.id })
			.from(adminSessions)
			.where(and(eq(adminSessions.jwtId, payload.jti), isNull(adminSessions.revokedAt)))
			.limit(1);
		if (!rows[0]) {
			return NextResponse.json({ error: "Unauthorized", code: "admin_session_revoked" }, { status: 401, headers: adminHeaders() });
		}
		return { jti: payload.jti };
	} catch (e) {
		const cause = e instanceof DrizzleQueryError ? e.cause : undefined;
		const dbAtCapacity = isPostgresTooManyConnectionsError(e);
		Sentry.captureException(e, {
			tags: {
				feature: "admin",
				phase: "require_admin_api_session_lookup",
				...(dbAtCapacity ? { admin_db_capacity: "true" } : {}),
			},
			extra: {
				...(cause instanceof Error ? { pgMessage: cause.message } : {}),
				...(dbAtCapacity ?
					{
						hint: "Postgres max connections (EMAXCONN). Use Supabase transaction pooler (:6543, …pooler.supabase.com), add pgbouncer=true to DATABASE_URL, set DATABASE_POOL_MAX=1.",
					}
				:	{}),
			},
		});
		return NextResponse.json(
			{ error: "Service unavailable", code: "admin_db_unavailable" },
			{ status: 503, headers: adminHeaders() },
		);
	}
}
