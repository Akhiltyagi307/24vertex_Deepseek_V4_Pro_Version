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

/**
 * Per-process cache of valid admin session ids. Without it, every admin API
 * call hits Postgres for the session-revoked check — under DB pressure, admin
 * routes 503 first, before public routes. 10s TTL is short enough that a
 * recently-revoked session is unusable within a normal click-cadence; full
 * revocation still happens via the JWT version bump on /api/admin/panic
 * (which all routes re-check at the edge in proxy-guard).
 *
 * Pinned on globalThis so HMR / dev rebuilds don't reset it.
 */
interface AdminSessionCacheEntry {
	cachedAt: number;
}
const ADMIN_SESSION_CACHE_TTL_MS = 10_000;
const ADMIN_SESSION_CACHE_MAX = 256;

const globalForAdminCache = globalThis as unknown as {
	__eduAiAdminSessionCache?: Map<string, AdminSessionCacheEntry>;
};
const adminSessionCache: Map<string, AdminSessionCacheEntry> =
	globalForAdminCache.__eduAiAdminSessionCache ?? new Map();
if (!globalForAdminCache.__eduAiAdminSessionCache) {
	globalForAdminCache.__eduAiAdminSessionCache = adminSessionCache;
}

function evictAdminSessionCacheIfFull() {
	if (adminSessionCache.size <= ADMIN_SESSION_CACHE_MAX) return;
	const overflow = adminSessionCache.size - ADMIN_SESSION_CACHE_MAX;
	let i = 0;
	for (const k of adminSessionCache.keys()) {
		if (i++ >= overflow) break;
		adminSessionCache.delete(k);
	}
}

function isAdminSessionCacheHit(jti: string): boolean {
	const entry = adminSessionCache.get(jti);
	if (!entry) return false;
	if (Date.now() - entry.cachedAt > ADMIN_SESSION_CACHE_TTL_MS) {
		adminSessionCache.delete(jti);
		return false;
	}
	return true;
}

function cacheAdminSession(jti: string): void {
	adminSessionCache.delete(jti);
	adminSessionCache.set(jti, { cachedAt: Date.now() });
	evictAdminSessionCacheIfFull();
}

/** Test-only — clear the cache. */
export function __resetAdminSessionCacheForTest(): void {
	adminSessionCache.clear();
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

	// Cache fast-path: if we verified this jti in the last 10s, skip the DB
	// roundtrip. Cache only stores valid sessions; nothing to forge here since
	// the JWT signature was just verified above.
	if (isAdminSessionCacheHit(payload.jti)) {
		return { jti: payload.jti };
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
		cacheAdminSession(payload.jti);
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
