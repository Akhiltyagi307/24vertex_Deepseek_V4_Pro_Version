import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const performAdminLogin = vi.fn();
const adminSessionCookieDescriptor = vi.fn(() => ({
	name: "admin_session",
	options: { httpOnly: true, secure: true, sameSite: "strict" as const, path: "/" },
}));

vi.mock("@/lib/admin/login-core", () => ({
	performAdminLogin,
	adminSessionCookieDescriptor,
}));

function loginRequest(init: {
	contentType?: string;
	body?: string;
} = {}): NextRequest {
	const headers = new Headers();
	if (init.contentType) headers.set("content-type", init.contentType);
	return new NextRequest(new URL("/api/admin/auth/login", "http://localhost:3001"), {
		method: "POST",
		headers,
		body: init.body,
	});
}

describe("D32 Sprint C · POST /api/admin/auth/login (route handler)", () => {
	afterEach(() => {
		performAdminLogin.mockReset();
		adminSessionCookieDescriptor.mockClear();
	});

	it("415 when content-type is not application/json", async () => {
		const { POST } = await import("@/app/api/admin/auth/login/route");
		const res = await POST(
			loginRequest({
				contentType: "application/x-www-form-urlencoded",
				body: "email=a@x&password=p",
			}),
		);
		expect(res.status).toBe(415);
		expect(res.headers.get("X-EduAI-Admin-Login-Handler")).toBe("app-route");
	});

	it("415 when content-type is multipart/form-data", async () => {
		const { POST } = await import("@/app/api/admin/auth/login/route");
		const res = await POST(loginRequest({ contentType: "multipart/form-data; boundary=x" }));
		expect(res.status).toBe(415);
	});

	it("400 when body JSON is malformed", async () => {
		const { POST } = await import("@/app/api/admin/auth/login/route");
		const res = await POST(
			loginRequest({ contentType: "application/json", body: "{ not-json" }),
		);
		expect(res.status).toBe(400);
		expect(res.headers.get("X-EduAI-Login-Code")).toBe("bad_request");
	});

	it("rejects when performAdminLogin returns not-ok", async () => {
		performAdminLogin.mockResolvedValueOnce({
			ok: false,
			status: 401,
			code: "invalid_credentials",
			message: "Sign-in failed",
		});
		const { POST } = await import("@/app/api/admin/auth/login/route");
		const res = await POST(
			loginRequest({
				contentType: "application/json",
				body: JSON.stringify({ email: "a@x", password: "p" }),
			}),
		);
		expect(res.status).toBe(401);
		expect(res.headers.get("X-EduAI-Login-Code")).toBe("invalid_credentials");
	});

	it("500 when performAdminLogin throws", async () => {
		performAdminLogin.mockRejectedValueOnce(new Error("boom"));
		const { POST } = await import("@/app/api/admin/auth/login/route");
		const res = await POST(
			loginRequest({
				contentType: "application/json",
				body: JSON.stringify({ email: "a@x", password: "p" }),
			}),
		);
		expect(res.status).toBe(500);
		expect(res.headers.get("X-EduAI-Login-Code")).toBe("internal_error");
	});

	it("happy path: sets cookie on success", async () => {
		performAdminLogin.mockResolvedValueOnce({ ok: true, token: "jwt-xxx" });
		const { POST } = await import("@/app/api/admin/auth/login/route");
		const res = await POST(
			loginRequest({
				contentType: "application/json",
				body: JSON.stringify({ email: "a@x", password: "p", totp: "123456" }),
			}),
		);
		expect(res.status).toBe(200);
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain("admin_session=");
	});
});
