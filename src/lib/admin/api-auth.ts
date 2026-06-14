import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import * as Sentry from "@sentry/nextjs";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { verifyAdminJwt } from "@/lib/admin/auth";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/constants";
import { isAdminRequestIpAllowed } from "@/lib/admin/ip-allowlist";
import { isAdminSessionRevoked } from "@/lib/admin/runtime-pg";
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
 * Implementation is a true LRU using `Map`'s insertion-order semantics:
 * every read promotes the entry to the end (delete + set), and eviction
 * always removes the oldest (`keys().next()`). The previous version
 * evicted the first N inserted entries when full, which under sustained
 * traffic could thrash recent entries while keeping cold ones — and a
 * revoked session that happened to be at the head was unusable for up
 * to 10s without the read promoting it. With proper LRU, a key that is
 * being actively used always stays warm; a quiet key falls off naturally.
 *
 * Pinned on globalThis so HMR / dev rebuilds don't reset it.
 */
interface AdminSessionCacheEntry {
	sessionId: string;
	cachedAt: number;
}
const ADMIN_SESSION_CACHE_TTL_MS = 10_000;
const ADMIN_SESSION_CACHE_MAX = 256;

const globalForAdminCache = globalThis as unknown as {
	__vertex24AdminSessionCache?: Map<string, AdminSessionCacheEntry>;
};
const adminSessionCache: Map<string, AdminSessionCacheEntry> =
	globalForAdminCache.__vertex24AdminSessionCache ?? new Map();
if (!globalForAdminCache.__vertex24AdminSessionCache) {
	globalForAdminCache.__vertex24AdminSessionCache = adminSessionCache;
}

function evictOldestAdminSessionEntries(): void {
	while (adminSessionCache.size > ADMIN_SESSION_CACHE_MAX) {
		// `keys()` iterates in insertion order; the first key is the oldest.
		// Each read of a hit promotes the key to the end via cacheAdminSession,
		// so the head is genuinely the least-recently-used.
		const oldest = adminSessionCache.keys().next();
		if (oldest.done) break;
		adminSessionCache.delete(oldest.value);
	}
}

async function isAdminSessionCacheHit(jti: string): Promise<{ sessionId: string } | null> {
	const entry = adminSessionCache.get(jti);
	if (!entry) return null;
	if (Date.now() - entry.cachedAt > ADMIN_SESSION_CACHE_TTL_MS) {
		adminSessionCache.delete(jti);
		return null;
	}
	// D10: in a multi-process deployment, a logout on Process B must invalidate
	// a cached entry on Process A. Per-jti tombstones in `admin_runtime_kv`
	// are written on logout and checked here on every cache hit. The lookup
	// is a primary-key SELECT — cheaper than the `admin_sessions` lookup we
	// avoided by hitting the cache. Net cost: one DB hit per cache hit (same
	// order of magnitude as the existing `jwt_version` read in verifyAdminJwt).
	if (await isAdminSessionRevoked(jti)) {
		adminSessionCache.delete(jti);
		return null;
	}
	// Promote on read: re-insert so this key is now the most recently used.
	// Without this, an actively-used session can still be the LRU head and
	// get evicted under cache pressure.
	adminSessionCache.delete(jti);
	adminSessionCache.set(jti, entry);
	return { sessionId: entry.sessionId };
}

function cacheAdminSession(jti: string, sessionId: string): void {
	adminSessionCache.delete(jti);
	adminSessionCache.set(jti, { sessionId, cachedAt: Date.now() });
	evictOldestAdminSessionEntries();
}

/** Test/admin-action hook: drop a single jti immediately (e.g. on revoke). */
export function invalidateAdminSessionCache(jti: string): void {
	adminSessionCache.delete(jti);
}

/** Test-only — clear the cache. */
export function __resetAdminSessionCacheForTest(): void {
	adminSessionCache.clear();
}

export async function requireAdminApi(): Promise<{ jti: string; sessionId: string } | NextResponse> {
	// Request-time IP allowlist: enforce on every admin API call, not just login,
	// so a leaked session cookie is unusable from a non-allowlisted IP. Cheapest
	// rejection — runs before the cookie read and DB lookup. No-op when
	// ADMIN_IP_ALLOWLIST is unset. /api/admin/panic (emergency revoke) and
	// /api/admin/auth/login enforce their own access and do not call this guard.
	if (!isAdminRequestIpAllowed(await headers())) {
		return NextResponse.json(
			{ error: "Forbidden", code: "admin_ip_blocked" },
			{ status: 403, headers: adminHeaders() },
		);
	}

	const jar = await cookies();
	const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
	if (!token) {
		return NextResponse.json({ error: "Unauthorized", code: "admin_unauthorized" }, { status: 401, headers: adminHeaders() });
	}
	const payload = await verifyAdminJwt(token);
	if (!payload) {
		return NextResponse.json({ error: "Unauthorized", code: "admin_invalid_token" }, { status: 401, headers: adminHeaders() });
	}

	// Cache fast-path: if we verified this jti in the last 10s, skip the DB
	// roundtrip. Cache only stores valid sessions; nothing to forge here since
	// the JWT signature was just verified above. D10: cache hit also consults
	// the cross-process revocation tombstone so a logout elsewhere is honored.
	const cached = await isAdminSessionCacheHit(payload.jti);
	if (cached) {
		return { jti: payload.jti, sessionId: cached.sessionId };
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
		const sessionId = rows[0].id;
		cacheAdminSession(payload.jti, sessionId);
		return { jti: payload.jti, sessionId };
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
