import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import * as Sentry from "@sentry/nextjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { clientIpFromHeaders } from "@/lib/admin/api-request-meta";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/constants";
import { verifyAdminJwt } from "@/lib/admin/auth";
import { isAdminIpAllowed } from "@/lib/admin/ip-allowlist";
import { isPostgresTooManyConnectionsError } from "@/lib/db/postgres-errors";
import { db } from "@/db";
import { adminSessions } from "@/db/schema/admin-sessions";

/**
 * Server Components / Server Actions: require valid admin JWT, Redis version, non-revoked session, optional IP allowlist.
 */
export async function requireAdmin(): Promise<void> {
	const jar = await cookies();
	const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
	if (!token) {
		redirect("/admin/login");
	}
	const payload = await verifyAdminJwt(token);
	if (!payload) {
		redirect("/admin/login");
	}

	const h = await headers();
	if (!isAdminIpAllowed(clientIpFromHeaders(h))) {
		redirect("/admin/login");
	}

	try {
		const rows = await db
			.select({ id: adminSessions.id })
			.from(adminSessions)
			.where(and(eq(adminSessions.jwtId, payload.jti), isNull(adminSessions.revokedAt)))
			.limit(1);
		if (!rows[0]) {
			redirect("/admin/login");
		}
	} catch (e) {
		const cause = e instanceof DrizzleQueryError ? e.cause : undefined;
		const dbAtCapacity = isPostgresTooManyConnectionsError(e);
		Sentry.captureException(e, {
			tags: {
				feature: "admin",
				phase: "require_admin_session_lookup",
				...(dbAtCapacity ? { admin_db_capacity: "true" } : {}),
			},
			extra: {
				...(cause instanceof Error ? { pgMessage: cause.message } : {}),
				...(dbAtCapacity ?
					{
						hint: "Postgres max connections (EMAXCONN). Use Supabase transaction pooler (:6543, …pooler.supabase.com), add pgbouncer=true to DATABASE_URL, set DATABASE_POOL_MAX=1, restart dev server.",
					}
				:	{}),
			},
		});
		redirect("/admin/login");
	}
}
