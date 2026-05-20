import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const revokeAdminSessionByJti = vi.fn(async () => undefined);
const selectLimit = vi.fn();
const clientIpFromHeaders = vi.fn(() => "127.0.0.1");

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { ADMIN_SESSION_REVOKE: "admin_session_revoke" },
}));
vi.mock("@/lib/admin/login-core", () => ({ revokeAdminSessionByJti }));
vi.mock("@/lib/admin/api-request-meta", () => ({ clientIpFromHeaders }));
vi.mock("@/db", () => ({
	db: { select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }) },
}));

describe("D32 Sprint C · POST /api/admin/sessions/[id]/revoke", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		revokeAdminSessionByJti.mockClear();
		selectLimit.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/sessions/[id]/revoke/route");
		const res = await POST(adminRequest("/api/admin/sessions/s1/revoke", { method: "POST" }), {
			params: Promise.resolve({ id: "s1" }),
		});
		expect(res.status).toBe(401);
	});

	it("404 when session not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/sessions/[id]/revoke/route");
		const res = await POST(adminRequest("/api/admin/sessions/s1/revoke", { method: "POST" }), {
			params: Promise.resolve({ id: "s1" }),
		});
		expect(res.status).toBe(404);
	});

	it("400 when trying to revoke current session", async () => {
		selectLimit.mockResolvedValueOnce([{ id: "s1", jwtId: ADMIN_GATE_ALLOW.jti }]);
		const { POST } = await import("@/app/api/admin/sessions/[id]/revoke/route");
		const res = await POST(adminRequest("/api/admin/sessions/s1/revoke", { method: "POST" }), {
			params: Promise.resolve({ id: "s1" }),
		});
		expect(res.status).toBe(400);
		expect(revokeAdminSessionByJti).not.toHaveBeenCalled();
	});

	it("happy path: strict audit + revoke", async () => {
		selectLimit.mockResolvedValueOnce([{ id: "s1", jwtId: "other-jti-12345678" }]);
		const { POST } = await import("@/app/api/admin/sessions/[id]/revoke/route");
		const res = await POST(adminRequest("/api/admin/sessions/s1/revoke", { method: "POST" }), {
			params: Promise.resolve({ id: "s1" }),
		});
		expect(res.status).toBe(200);
		expect(revokeAdminSessionByJti).toHaveBeenCalledWith("other-jti-12345678");
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
			payload: { jwt_id_prefix: string };
		};
		expect(audit.action).toBe("admin_session_revoke");
		expect(audit.targetId).toBe("s1");
		expect(audit.payload.jwt_id_prefix).toBe("other-jt");
	});
});
