import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const signOut = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { USER_SESSIONS_REVOKE_ALL: "user_sessions_revoke_all" },
}));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => ({
		auth: { admin: { signOut } },
	}),
}));

const USER_UUID = "90909090-9090-4090-8090-909090909090";

describe("POST /api/admin/users/[id]/revoke-sessions", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		signOut.mockClear();
		signOut.mockResolvedValue({ error: null });
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/users/[id]/revoke-sessions/route");
		const res = await POST(adminRequest(`/api/admin/users/${USER_UUID}/revoke-sessions`), {
			params: Promise.resolve({ id: USER_UUID }),
		});
		expect(res.status).toBe(401);
	});

	it("revokes all sessions via supabase admin", async () => {
		const { POST } = await import("@/app/api/admin/users/[id]/revoke-sessions/route");
		const res = await POST(adminRequest(`/api/admin/users/${USER_UUID}/revoke-sessions`), {
			params: Promise.resolve({ id: USER_UUID }),
		});
		expect(res.status).toBe(200);
		expect(signOut).toHaveBeenCalledWith(USER_UUID, "global");
		expect(writeAdminActionStrict).toHaveBeenCalled();
	});
});
