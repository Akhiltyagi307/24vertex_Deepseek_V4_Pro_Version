import bcrypt from "bcryptjs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/runtime-pg", () => ({
	getAdminJwtVersion: vi.fn(async () => 0),
	bumpAdminJwtVersion: vi.fn(async () => 1),
}));

describe("admin auth", () => {
	const prevSecret = process.env.ADMIN_JWT_SECRET;
	const prevPlain = process.env.ADMIN_PASSWORD;
	const prevHash = process.env.ADMIN_PASSWORD_HASH;
	const prevB64 = process.env.ADMIN_PASSWORD_HASH_B64;

	beforeAll(() => {
		process.env.ADMIN_JWT_SECRET = "unit-test-admin-jwt-secret-32bytes!";
		process.env.ADMIN_PASSWORD = "correct-horse-battery";
		delete process.env.ADMIN_PASSWORD_HASH;
		delete process.env.ADMIN_PASSWORD_HASH_B64;
	});

	afterAll(() => {
		process.env.ADMIN_JWT_SECRET = prevSecret;
		if (prevPlain === undefined) delete process.env.ADMIN_PASSWORD;
		else process.env.ADMIN_PASSWORD = prevPlain;
		if (prevHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
		else process.env.ADMIN_PASSWORD_HASH = prevHash;
		if (prevB64 === undefined) delete process.env.ADMIN_PASSWORD_HASH_B64;
		else process.env.ADMIN_PASSWORD_HASH_B64 = prevB64;
	});

	it("normalizeBcryptHashFromEnv unescapes Next-style \\$ dollars", async () => {
		const { normalizeBcryptHashFromEnv } = await import("@/lib/admin/auth");
		const raw = String.raw`\$2b\$12\$mXLcOnteBMGkDSo14u25ROyXAN4ehv5Qo7tbsl6eTSt43VlMssHaC`;
		const h = normalizeBcryptHashFromEnv(raw);
		expect(h.startsWith("$2b$12$")).toBe(true);
	});

	it("password verify: plain ADMIN_PASSWORD, then bcrypt legacy when plain unset", async () => {
		const { verifyAdminPassword } = await import("@/lib/admin/auth");
		expect(await verifyAdminPassword("wrong")).toBe(false);
		expect(await verifyAdminPassword("correct-horse-battery")).toBe(true);

		delete process.env.ADMIN_PASSWORD;
		process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("legacy-only", 8);
		expect(await verifyAdminPassword("wrong")).toBe(false);
		expect(await verifyAdminPassword("legacy-only")).toBe(true);

		process.env.ADMIN_PASSWORD = "correct-horse-battery";
		delete process.env.ADMIN_PASSWORD_HASH;
	});

	it("ADMIN_PASSWORD_HASH_B64 verifies and overrides plain ADMIN_PASSWORD", async () => {
		const rawHash = bcrypt.hashSync("secret-from-b64", 12);
		process.env.ADMIN_PASSWORD_HASH_B64 = Buffer.from(rawHash, "utf8").toString("base64");
		process.env.ADMIN_PASSWORD = "correct-horse-battery";
		vi.resetModules();
		const { verifyAdminPassword } = await import("@/lib/admin/auth");
		expect(await verifyAdminPassword("correct-horse-battery")).toBe(false);
		expect(await verifyAdminPassword("secret-from-b64")).toBe(true);
		delete process.env.ADMIN_PASSWORD_HASH_B64;
		process.env.ADMIN_PASSWORD = "correct-horse-battery";
		vi.resetModules();
	});

	it("JWT sign and verify", async () => {
		const { signAdminJwt, verifyAdminJwt } = await import("@/lib/admin/auth");
		const token = await signAdminJwt({ jti: "test-jti-1", jwtVersion: 0 });
		const payload = await verifyAdminJwt(token);
		expect(payload?.jti).toBe("test-jti-1");
		expect(payload?.v).toBe(0);
	});

	it("TOTP verify accepts valid window", async () => {
		const { verifyTotp } = await import("@/lib/admin/totp");
		expect(verifyTotp(undefined, "123456")).toBe(false);
		expect(verifyTotp("SECRET", "")).toBe(false);
	});

	describe("production bcrypt minimum cost (§10.6)", () => {
		afterEach(() => {
			vi.unstubAllEnvs();
			process.env.ADMIN_PASSWORD = "correct-horse-battery";
			delete process.env.ADMIN_PASSWORD_HASH;
			delete process.env.ADMIN_PASSWORD_HASH_B64;
			vi.resetModules();
		});

		it("rejects bcrypt cost < 12 when NODE_ENV is production", async () => {
			vi.stubEnv("NODE_ENV", "production");
			delete process.env.ADMIN_PASSWORD;
			process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("weakcost", 8);
			vi.resetModules();
			const { verifyAdminPassword } = await import("@/lib/admin/auth");
			expect(await verifyAdminPassword("weakcost")).toBe(false);
		});

		it("accepts bcrypt cost 12 when NODE_ENV is production", async () => {
			vi.stubEnv("NODE_ENV", "production");
			delete process.env.ADMIN_PASSWORD;
			process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("strongcost", 12);
			vi.resetModules();
			const { verifyAdminPassword } = await import("@/lib/admin/auth");
			expect(await verifyAdminPassword("strongcost")).toBe(true);
		});
	});
});
