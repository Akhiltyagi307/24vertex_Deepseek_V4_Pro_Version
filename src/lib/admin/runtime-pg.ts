import "server-only";

import { and, eq, gt, like, lt, sql } from "drizzle-orm";

import {
	ADMIN_RUNTIME_KV_JWT_KID,
	ADMIN_RUNTIME_KV_JWT_VERSION,
	ADMIN_RUNTIME_KV_REVOKED_PREFIX,
	ADMIN_RUNTIME_KV_TOTP_FINGERPRINT,
	ADMIN_SESSION_REVOKE_TTL_MS,
} from "@/lib/admin/constants";
import { db } from "@/db";
import { adminRuntimeKv } from "@/db/schema/admin-runtime-kv";

export async function getAdminJwtVersion(): Promise<number> {
	try {
		const rows = await db
			.select({ v: adminRuntimeKv.valueInt })
			.from(adminRuntimeKv)
			.where(eq(adminRuntimeKv.key, ADMIN_RUNTIME_KV_JWT_VERSION))
			.limit(1);
		return rows[0]?.v ?? 0;
	} catch {
		return 0;
	}
}

/** Bump stored JWT version (panic); returns new version. */
export async function bumpAdminJwtVersion(): Promise<number> {
	const [row] = await db
		.insert(adminRuntimeKv)
		.values({
			key: ADMIN_RUNTIME_KV_JWT_VERSION,
			valueInt: 1,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: adminRuntimeKv.key,
			set: {
				valueInt: sql`${adminRuntimeKv.valueInt} + 1`,
				updatedAt: sql`now()`,
			},
		})
		.returning({ valueInt: adminRuntimeKv.valueInt });
	return row?.valueInt ?? 1;
}

/**
 * D10: Record a per-jti revocation tombstone visible across Node processes.
 * Writes `admin_runtime_kv` row keyed `revoked:<jti>` with `value_int` =
 * expires_at epoch ms. Cleared lazily by `maybePruneExpiredAdminSessionRevocations`.
 */
export async function recordAdminSessionRevocation(
	jti: string,
	ttlMs: number = ADMIN_SESSION_REVOKE_TTL_MS,
): Promise<void> {
	const expiresAt = Date.now() + ttlMs;
	const key = `${ADMIN_RUNTIME_KV_REVOKED_PREFIX}${jti}`;
	try {
		await db
			.insert(adminRuntimeKv)
			.values({
				key,
				valueInt: expiresAt,
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: adminRuntimeKv.key,
				set: {
					valueInt: expiresAt,
					updatedAt: sql`now()`,
				},
			});
	} catch {
		// D10 best-effort: cross-process invalidation is a hardening, not a
		// safety property. The same-process cache eviction + DB-level
		// admin_sessions.revoked_at filter still close the door.
	}
}

/** Returns true if a non-expired revocation tombstone exists for `jti`. */
export async function isAdminSessionRevoked(jti: string): Promise<boolean> {
	try {
		const key = `${ADMIN_RUNTIME_KV_REVOKED_PREFIX}${jti}`;
		const now = Date.now();
		const rows = await db
			.select({ v: adminRuntimeKv.valueInt })
			.from(adminRuntimeKv)
			.where(and(eq(adminRuntimeKv.key, key), gt(adminRuntimeKv.valueInt, now)))
			.limit(1);
		return rows.length > 0;
	} catch {
		// On DB failure we fall back to "not revoked" — the cache-miss path
		// will still consult `admin_sessions.revoked_at` which is authoritative.
		return false;
	}
}

const PRUNE_THROTTLE_MS = 60_000;
let lastRevokePruneAt = 0;

/**
 * Best-effort cleanup of expired revoke tombstones. Throttled to once
 * per 60s per process to avoid hot-pathing the DB on every logout.
 */
export async function maybePruneExpiredAdminSessionRevocations(): Promise<void> {
	const now = Date.now();
	if (now - lastRevokePruneAt < PRUNE_THROTTLE_MS) return;
	lastRevokePruneAt = now;
	try {
		await db
			.delete(adminRuntimeKv)
			.where(
				and(
					like(adminRuntimeKv.key, `${ADMIN_RUNTIME_KV_REVOKED_PREFIX}%`),
					lt(adminRuntimeKv.valueInt, now),
				),
			);
	} catch {
		// Don't propagate cleanup failures.
	}
}

/** Test-only — reset throttling state so a unit test can exercise the prune path. */
export function __resetAdminRevokePruneThrottleForTest(): void {
	lastRevokePruneAt = 0;
}

// ---- D3/D13: TOTP secret fingerprint tracking ----

/** Returns the SHA-256 hex fingerprint stored for the TOTP secret, or null. */
export async function getAdminTotpFingerprint(): Promise<string | null> {
	try {
		const rows = await db
			.select({ json: adminRuntimeKv.valueJson })
			.from(adminRuntimeKv)
			.where(eq(adminRuntimeKv.key, ADMIN_RUNTIME_KV_TOTP_FINGERPRINT))
			.limit(1);
		const json = rows[0]?.json as { fingerprint?: string } | null | undefined;
		const fp = json?.fingerprint;
		return typeof fp === "string" && fp.length > 0 ? fp : null;
	} catch {
		return null;
	}
}

export async function setAdminTotpFingerprint(fingerprint: string): Promise<void> {
	try {
		await db
			.insert(adminRuntimeKv)
			.values({
				key: ADMIN_RUNTIME_KV_TOTP_FINGERPRINT,
				valueInt: 0,
				valueJson: { fingerprint },
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: adminRuntimeKv.key,
				set: { valueJson: { fingerprint }, updatedAt: sql`now()` },
			});
	} catch {
		// Best-effort: rotation tracking is informational. The auth path
		// remains correct even if the fingerprint write fails.
	}
}

// ---- D4/D12: JWT kid rotation ----

/** Returns the active JWT kid, or null when unset (legacy single-secret mode). */
export async function getAdminJwtKid(): Promise<string | null> {
	try {
		const rows = await db
			.select({ json: adminRuntimeKv.valueJson })
			.from(adminRuntimeKv)
			.where(eq(adminRuntimeKv.key, ADMIN_RUNTIME_KV_JWT_KID))
			.limit(1);
		const json = rows[0]?.json as { kid?: string } | null | undefined;
		const kid = json?.kid;
		return typeof kid === "string" && kid.length > 0 ? kid : null;
	} catch {
		return null;
	}
}

export async function setAdminJwtKid(kid: string): Promise<void> {
	await db
		.insert(adminRuntimeKv)
		.values({
			key: ADMIN_RUNTIME_KV_JWT_KID,
			valueInt: 0,
			valueJson: { kid },
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: adminRuntimeKv.key,
			set: { valueJson: { kid }, updatedAt: sql`now()` },
		});
}
