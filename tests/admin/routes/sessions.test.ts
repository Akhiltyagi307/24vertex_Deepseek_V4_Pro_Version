import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest, FAKE_ADMIN_JTI } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const revokeAdminSessionByJti = vi.fn(async () => {});
const listOrderBy = vi.fn();
const lookupLimit = vi.fn();
let nextSelect: "list" | "lookup" = "list";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { ADMIN_SESSION_REVOKE: "admin_session_revoke" },
}));
vi.mock("@/lib/admin/login-core", () => ({ revokeAdminSessionByJti }));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => {
			if (nextSelect === "lookup") {
				return { from: () => ({ where: () => ({ limit: lookupLimit }) }) };
			}
			return { from: () => ({ where: () => ({ orderBy: listOrderBy }) }) };
		}),
	},
}));

const SESSION_ID = "sess-1234";

describe("D32 Sprint C · admin/sessions list + [id]/revoke", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		revokeAdminSessionByJti.mockClear();
		listOrderBy.mockReset();
		lookupLimit.mockReset();
		nextSelect = "list";
	});

	it("list GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/sessions/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("list GET: returns active sessions and marks current", async () => {
		listOrderBy.mockResolvedValueOnce([
			{
				id: "s1",
				jwtId: FAKE_ADMIN_JTI,
				ipAddress: "127.0.0.1",
				userAgent: "ua",
				totpUsed: true,
				createdAt: new Date(),
				lastSeenAt: new Date(),
			},
			{
				id: "s2",
				jwtId: "other-jti",
				ipAddress: null,
				userAgent: null,
				totpUsed: false,
				createdAt: new Date(),
				lastSeenAt: new Date(),
			},
		]);
		const { GET } = await import("@/app/api/admin/sessions/route");
		const res = await GET();
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string; is_current: boolean }[] };
		expect(body.data[0]?.is_current).toBe(true);
		expect(body.data[1]?.is_current).toBe(false);
	});

	it("revoke POST: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/sessions/[id]/revoke/route");
		const res = await POST(
			adminRequest(`/api/admin/sessions/${SESSION_ID}/revoke`),
			{ params: Promise.resolve({ id: SESSION_ID }) },
		);
		expect(res.status).toBe(401);
	});

	it("revoke POST: 404 when session not found", async () => {
		nextSelect = "lookup";
		lookupLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/sessions/[id]/revoke/route");
		const res = await POST(
			adminRequest(`/api/admin/sessions/${SESSION_ID}/revoke`),
			{ params: Promise.resolve({ id: SESSION_ID }) },
		);
		expect(res.status).toBe(404);
	});

	it("revoke POST: rejects revoking the current session", async () => {
		nextSelect = "lookup";
		lookupLimit.mockResolvedValueOnce([{ id: SESSION_ID, jwtId: FAKE_ADMIN_JTI }]);
		const { POST } = await import("@/app/api/admin/sessions/[id]/revoke/route");
		const res = await POST(
			adminRequest(`/api/admin/sessions/${SESSION_ID}/revoke`),
			{ params: Promise.resolve({ id: SESSION_ID }) },
		);
		expect(res.status).toBe(400);
		expect(revokeAdminSessionByJti).not.toHaveBeenCalled();
	});

	it("revoke POST: happy path strict-audits + revokes", async () => {
		nextSelect = "lookup";
		lookupLimit.mockResolvedValueOnce([{ id: SESSION_ID, jwtId: "other-jti-1234" }]);
		const { POST } = await import("@/app/api/admin/sessions/[id]/revoke/route");
		const res = await POST(
			adminRequest(`/api/admin/sessions/${SESSION_ID}/revoke`),
			{ params: Promise.resolve({ id: SESSION_ID }) },
		);
		expect(res.status).toBe(200);
		expect(revokeAdminSessionByJti).toHaveBeenCalledWith("other-jti-1234");
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
			payload: { jwt_id_prefix: string };
		};
		expect(audit.action).toBe("admin_session_revoke");
		expect(audit.targetId).toBe(SESSION_ID);
		expect(audit.payload.jwt_id_prefix).toBe("other-jt");
	});
});
