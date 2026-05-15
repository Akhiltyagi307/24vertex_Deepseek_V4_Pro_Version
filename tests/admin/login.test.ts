import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.ADMIN_INTEGRATION_TESTS === "true" && process.env.DATABASE_URL?.trim());

describe.skipIf(!hasDb)("admin login core (integration)", () => {
	const prevEmail = process.env.ADMIN_EMAIL;
	const prevPlain = process.env.ADMIN_PASSWORD;
	const prevHash = process.env.ADMIN_PASSWORD_HASH;
	const prevHashB64 = process.env.ADMIN_PASSWORD_HASH_B64;
	const prevSecret = process.env.ADMIN_JWT_SECRET;

	beforeAll(() => {
		process.env.ADMIN_EMAIL = "admin@test.local";
		process.env.ADMIN_PASSWORD = "good-password";
		delete process.env.ADMIN_PASSWORD_HASH;
		delete process.env.ADMIN_PASSWORD_HASH_B64;
		process.env.ADMIN_JWT_SECRET = "unit-test-admin-jwt-secret-32bytes!";
	});

	afterAll(() => {
		process.env.ADMIN_EMAIL = prevEmail;
		if (prevPlain === undefined) delete process.env.ADMIN_PASSWORD;
		else process.env.ADMIN_PASSWORD = prevPlain;
		if (prevHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
		else process.env.ADMIN_PASSWORD_HASH = prevHash;
		if (prevHashB64 === undefined) delete process.env.ADMIN_PASSWORD_HASH_B64;
		else process.env.ADMIN_PASSWORD_HASH_B64 = prevHashB64;
		process.env.ADMIN_JWT_SECRET = prevSecret;
	});

	it("rejects wrong password", async () => {
		const { performAdminLogin } = await import("@/lib/admin/login-core");
		const req = new NextRequest(new URL("http://localhost:3001/api/admin/auth/login"), {
			headers: { "x-forwarded-for": "203.0.113.10" },
		});
		const result = await performAdminLogin(req, {
			email: "admin@test.local",
			password: "bad-password",
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(401);
		}
	});
});
