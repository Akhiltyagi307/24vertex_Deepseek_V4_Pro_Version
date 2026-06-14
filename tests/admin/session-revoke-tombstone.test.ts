import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D10: cross-process admin session revocation via `admin_runtime_kv` tombstone.
 *
 * The cache lives in `src/lib/admin/api-auth.ts`. To exercise the
 * cache-hit → revoked → 401 path without a live DB, we mock:
 *   - `next/headers` cookies()                  (carries the admin JWT)
 *   - `@/lib/admin/auth` verifyAdminJwt         (returns a fixed payload)
 *   - `@/lib/admin/runtime-pg` isAdminSessionRevoked + getAdminJwtVersion
 *   - `@/db`                                    (admin_sessions select)
 *
 * The point is to assert *wiring*: a tombstone hit on a cached jti returns
 * 401 with the right code, and the cache entry is evicted so the next call
 * with a fresh DB lookup is reached.
 */

const adminSelectLimit = vi.fn();
const adminSelectWhere = vi.fn(() => ({ limit: adminSelectLimit }));
const adminSelectFrom = vi.fn(() => ({ where: adminSelectWhere }));
const adminSelect = vi.fn(() => ({ from: adminSelectFrom }));

vi.mock("next/headers", () => ({
	cookies: vi.fn(async () => ({
		get: (name: string) =>
			name === "edu_admin_session" ? { value: "FAKE.ADMIN.JWT" } : undefined,
	})),
	// requireAdminApi now resolves the client IP for the request-time allowlist
	// check; ADMIN_IP_ALLOWLIST is unset in tests so this is a no-op pass.
	headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/admin/auth", () => ({
	verifyAdminJwt: vi.fn(async () => ({ jti: "test-jti-d10", v: 0 })),
}));

const isAdminSessionRevoked = vi.fn(async () => false);

vi.mock("@/lib/admin/runtime-pg", () => ({
	isAdminSessionRevoked,
	getAdminJwtVersion: vi.fn(async () => 0),
	bumpAdminJwtVersion: vi.fn(async () => 1),
	recordAdminSessionRevocation: vi.fn(async () => {}),
	maybePruneExpiredAdminSessionRevocations: vi.fn(async () => {}),
	getAdminJwtKid: vi.fn(async () => null),
	setAdminJwtKid: vi.fn(async () => {}),
	getAdminTotpFingerprint: vi.fn(async () => null),
	setAdminTotpFingerprint: vi.fn(async () => {}),
}));

vi.mock("@/db", () => ({
	db: {
		select: adminSelect,
	},
}));

describe("D10: cross-process admin session revocation tombstone", () => {
	beforeEach(async () => {
		adminSelectLimit.mockReset();
		isAdminSessionRevoked.mockReset();
		isAdminSessionRevoked.mockResolvedValue(false);
		const { __resetAdminSessionCacheForTest } = await import("@/lib/admin/api-auth");
		__resetAdminSessionCacheForTest();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("populates the cache on first call, then cache-hits without DB", async () => {
		adminSelectLimit.mockResolvedValueOnce([{ id: "session-row-1" }]);
		const { requireAdminApi } = await import("@/lib/admin/api-auth");

		const first = await requireAdminApi();
		expect("jti" in first ? first.sessionId : null).toBe("session-row-1");
		expect(adminSelectLimit).toHaveBeenCalledTimes(1);

		// Second call should hit the cache. admin_sessions is NOT queried again,
		// but the revoke tombstone IS consulted.
		isAdminSessionRevoked.mockResolvedValueOnce(false);
		const second = await requireAdminApi();
		expect("jti" in second ? second.sessionId : null).toBe("session-row-1");
		expect(adminSelectLimit).toHaveBeenCalledTimes(1); // unchanged
		expect(isAdminSessionRevoked).toHaveBeenCalledWith("test-jti-d10");
	});

	it("evicts the cached entry and returns 401 when the tombstone says revoked", async () => {
		adminSelectLimit.mockResolvedValueOnce([{ id: "session-row-1" }]);
		const { requireAdminApi } = await import("@/lib/admin/api-auth");

		// Prime cache.
		await requireAdminApi();
		expect(adminSelectLimit).toHaveBeenCalledTimes(1);

		// Simulate cross-process logout: tombstone now returns true.
		isAdminSessionRevoked.mockResolvedValueOnce(true);

		// admin_sessions lookup on the cache-miss fallback must also reject,
		// matching the real DB-level revokedAt filter behavior.
		adminSelectLimit.mockResolvedValueOnce([]);

		const after = await requireAdminApi();
		// requireAdminApi returns a NextResponse on rejection.
		expect(after).toHaveProperty("status");
		// @ts-expect-error — narrowing in a test
		expect(after.status).toBe(401);
	});

	it("does not check revoke tombstone when cache is empty (cache-miss path)", async () => {
		// Cache empty — cache-miss path goes straight to admin_sessions and does not
		// consult the tombstone (the admin_sessions `revoked_at` filter is the
		// authoritative DB-level check).
		adminSelectLimit.mockResolvedValueOnce([{ id: "session-row-fresh" }]);
		const { requireAdminApi } = await import("@/lib/admin/api-auth");

		const r = await requireAdminApi();
		expect("jti" in r ? r.sessionId : null).toBe("session-row-fresh");
		expect(isAdminSessionRevoked).not.toHaveBeenCalled();
	});
});
