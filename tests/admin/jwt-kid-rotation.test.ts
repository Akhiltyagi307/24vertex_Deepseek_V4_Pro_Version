import * as jose from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D4 / D12: HS256 + `kid` header rotation via `admin_runtime_kv`.
 *
 * The behavior under test is:
 *   - signAdminJwt() reads the current kid from KV and stamps it into the
 *     JWT header. When the KV row is empty, no kid is set (back-compat).
 *   - verifyAdminJwt() peeks at the header's kid (without verifying the
 *     signature), then resolves the matching env key. Tokens claiming a
 *     retired kid (no matching env var) are rejected.
 *   - chooseNextAdminJwtKid() picks the lowest-numbered v* secret env that
 *     isn't the current kid, used by panic to rotate.
 */

const currentKid = vi.fn(async () => null as string | null);

vi.mock("@/lib/admin/runtime-pg", () => ({
	getAdminJwtVersion: vi.fn(async () => 0),
	getAdminJwtKid: currentKid,
	bumpAdminJwtVersion: vi.fn(async () => 1),
	setAdminJwtKid: vi.fn(async () => {}),
	getAdminTotpFingerprint: vi.fn(async () => null),
	setAdminTotpFingerprint: vi.fn(async () => {}),
	isAdminSessionRevoked: vi.fn(async () => false),
	recordAdminSessionRevocation: vi.fn(async () => {}),
	maybePruneExpiredAdminSessionRevocations: vi.fn(async () => {}),
}));

describe("D4 / D12: JWT kid rotation", () => {
	const prevSecret = process.env.ADMIN_JWT_SECRET;

	beforeEach(() => {
		process.env.ADMIN_JWT_SECRET = "legacy-secret-32bytes-long-padding-test";
		for (const k of Object.keys(process.env)) {
			if (k.startsWith("ADMIN_JWT_SECRET_")) delete process.env[k];
		}
		currentKid.mockReset();
		currentKid.mockResolvedValue(null);
		vi.resetModules();
	});

	afterEach(() => {
		process.env.ADMIN_JWT_SECRET = prevSecret;
	});

	it("resolveAdminJwtKeyBytes returns ADMIN_JWT_SECRET when kid is null (legacy)", async () => {
		const { resolveAdminJwtKeyBytes } = await import("@/lib/admin/auth");
		const key = resolveAdminJwtKeyBytes(null);
		expect(key).not.toBeNull();
	});

	it("resolveAdminJwtKeyBytes returns null when kid is set but no env match (intentional reject)", async () => {
		const { resolveAdminJwtKeyBytes } = await import("@/lib/admin/auth");
		expect(resolveAdminJwtKeyBytes("retired_kid")).toBeNull();
	});

	it("resolveAdminJwtKeyBytes returns env-keyed bytes when kid matches", async () => {
		process.env.ADMIN_JWT_SECRET_v1 = "fresh-secret-32bytes-long-padding-vone";
		const { resolveAdminJwtKeyBytes } = await import("@/lib/admin/auth");
		const key = resolveAdminJwtKeyBytes("v1");
		expect(key).not.toBeNull();
		expect(key && new TextDecoder().decode(key)).toBe(
			"fresh-secret-32bytes-long-padding-vone",
		);
		delete process.env.ADMIN_JWT_SECRET_v1;
	});

	it("chooseNextAdminJwtKid picks the lowest-numbered v* env not equal to current", async () => {
		process.env.ADMIN_JWT_SECRET_v2 = "secret-v2";
		process.env.ADMIN_JWT_SECRET_v3 = "secret-v3";
		const { chooseNextAdminJwtKid } = await import("@/lib/admin/auth");
		expect(chooseNextAdminJwtKid(null)).toBe("v2");
		expect(chooseNextAdminJwtKid("v2")).toBe("v3");
		expect(chooseNextAdminJwtKid("v3")).toBe("v2");
		delete process.env.ADMIN_JWT_SECRET_v2;
		delete process.env.ADMIN_JWT_SECRET_v3;
	});

	it("chooseNextAdminJwtKid returns null when no fresh env is available", async () => {
		const { chooseNextAdminJwtKid } = await import("@/lib/admin/auth");
		expect(chooseNextAdminJwtKid(null)).toBeNull();
	});

	it("signAdminJwt + verifyAdminJwt round-trip with null kid (legacy)", async () => {
		const { signAdminJwt, verifyAdminJwt } = await import("@/lib/admin/auth");
		const token = await signAdminJwt({ jti: "jti-legacy", jwtVersion: 0 });
		const payload = await verifyAdminJwt(token);
		expect(payload?.jti).toBe("jti-legacy");
		// Legacy token must NOT carry a kid header.
		const header = jose.decodeProtectedHeader(token);
		expect(header.kid).toBeUndefined();
	});

	it("signAdminJwt + verifyAdminJwt round-trip with kid set", async () => {
		process.env.ADMIN_JWT_SECRET_v1 = "fresh-secret-32bytes-long-padding-v1";
		currentKid.mockResolvedValue("v1");
		const { signAdminJwt, verifyAdminJwt } = await import("@/lib/admin/auth");
		const token = await signAdminJwt({ jti: "jti-v1", jwtVersion: 0 });
		const header = jose.decodeProtectedHeader(token);
		expect(header.kid).toBe("v1");
		const payload = await verifyAdminJwt(token);
		expect(payload?.jti).toBe("jti-v1");
		delete process.env.ADMIN_JWT_SECRET_v1;
	});

	it("verifyAdminJwt rejects a token whose kid no longer has an env match", async () => {
		process.env.ADMIN_JWT_SECRET_v1 = "fresh-secret-32bytes-long-padding-v1";
		currentKid.mockResolvedValue("v1");
		const { signAdminJwt } = await import("@/lib/admin/auth");
		const token = await signAdminJwt({ jti: "jti-v1", jwtVersion: 0 });
		// Operator retires v1 after rotation; the token's claimed kid no
		// longer resolves to a key.
		delete process.env.ADMIN_JWT_SECRET_v1;
		const { verifyAdminJwt } = await import("@/lib/admin/auth");
		const payload = await verifyAdminJwt(token);
		expect(payload).toBeNull();
	});
});
