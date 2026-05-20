import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const adminGetUserById = vi.fn<(id: string) => Promise<{ email: string; full_name: string } | null>>();
const anonymizeProfile = vi.fn(async () => {});

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/anonymize", () => ({ anonymizeProfile }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { USER_SOFT_DELETE: "user_soft_delete" },
}));
vi.mock("@/lib/admin/users-list", () => ({ adminGetUserById }));

const VALID_UUID = "66666666-6666-4666-8666-666666666666";

describe("D32 Sprint B · POST /api/admin/users/[id]/soft-delete", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		adminGetUserById.mockReset();
		anonymizeProfile.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/users/[id]/soft-delete/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/soft-delete`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
		expect(anonymizeProfile).not.toHaveBeenCalled();
	});

	it("rejects invalid UUID", async () => {
		const { POST } = await import("@/app/api/admin/users/[id]/soft-delete/route");
		const res = await POST(
			adminRequest("/api/admin/users/bad/soft-delete"),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when user not found", async () => {
		adminGetUserById.mockResolvedValueOnce(null);
		const { POST } = await import("@/app/api/admin/users/[id]/soft-delete/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/soft-delete`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(404);
		expect(anonymizeProfile).not.toHaveBeenCalled();
	});

	it("anonymizes + strict-audits with PII snapshot on success", async () => {
		adminGetUserById.mockResolvedValueOnce({ email: "u@example.com", full_name: "User" });
		const { POST } = await import("@/app/api/admin/users/[id]/soft-delete/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/soft-delete`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(anonymizeProfile).toHaveBeenCalledWith(VALID_UUID);
		expect(writeAdminActionStrict).toHaveBeenCalledTimes(1);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { email_snapshot: string; full_name_snapshot: string };
		};
		expect(audit.action).toBe("user_soft_delete");
		expect(audit.payload.email_snapshot).toBe("u@example.com");
		expect(audit.payload.full_name_snapshot).toBe("User");
	});
});
