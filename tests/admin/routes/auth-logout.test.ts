import { describe, expect, it, vi } from "vitest";

import { adminRequest } from "../_helpers/admin-route";

const verifyAdminJwt = vi.fn<(token: string) => Promise<{ jti: string; v: number } | null>>(
	async () => ({ jti: "jti-xyz", v: 0 }),
);
const revokeAdminSessionByJti = vi.fn<(jti: string) => Promise<void>>(async () => {});
const writeAdminAction = vi.fn(async () => true);
const invalidateAdminSessionCache = vi.fn();
const recordAdminSessionRevocation = vi.fn(async () => {});
const maybePruneExpiredAdminSessionRevocations = vi.fn(async () => {});

vi.mock("next/headers", () => ({
	cookies: vi.fn(async () => ({
		get: (name: string) =>
			name === "edu_admin_session" ? { value: "FAKE.JWT.TOKEN" } : undefined,
	})),
}));

vi.mock("@/lib/admin/auth", () => ({ verifyAdminJwt }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { LOGOUT: "logout" },
}));
vi.mock("@/lib/admin/api-auth", () => ({ invalidateAdminSessionCache }));
vi.mock("@/lib/admin/login-core", () => ({
	adminSessionCookieDescriptor: () => ({
		name: "edu_admin_session",
		options: {
			httpOnly: true,
			secure: false,
			sameSite: "strict",
			path: "/",
			maxAge: 8 * 60 * 60,
		},
	}),
	revokeAdminSessionByJti,
}));
vi.mock("@/lib/admin/runtime-pg", () => ({
	maybePruneExpiredAdminSessionRevocations,
	recordAdminSessionRevocation,
}));

describe("D32 Sprint A · POST /api/admin/auth/logout", () => {
	it("revokes session + invalidates cache + writes tombstone when JWT is valid", async () => {
		const { POST } = await import("@/app/api/admin/auth/logout/route");
		const res = await POST(adminRequest("/api/admin/auth/logout"));
		expect(res.status).toBe(200);
		expect(revokeAdminSessionByJti).toHaveBeenCalledWith("jti-xyz");
		expect(invalidateAdminSessionCache).toHaveBeenCalledWith("jti-xyz");
		expect(recordAdminSessionRevocation).toHaveBeenCalledWith("jti-xyz");
		expect(writeAdminAction).toHaveBeenCalled();

		// Cookie cleared (Set-Cookie with maxAge=0 / Max-Age=0).
		const setCookie = res.headers.get("set-cookie");
		expect(setCookie).toBeTruthy();
		expect(setCookie).toMatch(/edu_admin_session=/);
		expect(setCookie).toMatch(/Max-Age=0/i);
	});

	it("clears cookie and 200s when JWT is invalid (no revoke calls)", async () => {
		revokeAdminSessionByJti.mockClear();
		invalidateAdminSessionCache.mockClear();
		writeAdminAction.mockClear();
		verifyAdminJwt.mockResolvedValueOnce(null);
		const { POST } = await import("@/app/api/admin/auth/logout/route");
		const res = await POST(adminRequest("/api/admin/auth/logout"));
		expect(res.status).toBe(200);
		expect(revokeAdminSessionByJti).not.toHaveBeenCalled();
		expect(invalidateAdminSessionCache).not.toHaveBeenCalled();
		expect(writeAdminAction).not.toHaveBeenCalled();
		const setCookie = res.headers.get("set-cookie");
		expect(setCookie).toMatch(/Max-Age=0/i);
	});
});
