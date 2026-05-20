import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const updateWhere = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { ADMIN_SESSIONS_REVOKE_OTHERS: "admin_sessions_revoke_others" },
}));
vi.mock("@/db", () => ({
	db: { update: () => ({ set: () => ({ where: updateWhere }) }) },
}));

describe("D32 Sprint C · POST /api/admin/sessions/revoke-others", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		updateWhere.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/sessions/revoke-others/route");
		const res = await POST(adminRequest("/api/admin/sessions/revoke-others"));
		expect(res.status).toBe(401);
	});

	it("happy path: strict-audits then bulk-revokes other admin sessions", async () => {
		const { POST } = await import("@/app/api/admin/sessions/revoke-others/route");
		const res = await POST(adminRequest("/api/admin/sessions/revoke-others"));
		expect(res.status).toBe(200);
		expect(writeAdminActionStrict).toHaveBeenCalledTimes(1);
		expect(updateWhere).toHaveBeenCalled();
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { scope: string };
		};
		expect(audit.action).toBe("admin_sessions_revoke_others");
		expect(audit.payload.scope).toBe("all_except_current");
	});
});
