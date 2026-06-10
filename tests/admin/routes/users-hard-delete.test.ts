import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const adminGetUserById = vi.fn<(id: string) => Promise<{ email: string; full_name: string | null } | null>>();
const verifyAdminTotpIfConfigured = vi.fn(() => true);
const consumeAdminTotp = vi.fn(async () => verifyAdminTotpIfConfigured());
const isAdminTotpRequired = vi.fn(async () => false);
const consumeAdminActionRateLimit = vi.fn(async () => ({
	allowed: true,
	remaining: 2,
	resetAt: new Date(Date.now() + 60_000),
	degraded: false,
}));
// Hard-delete is now "erase + disable" (review M7/FK): the auth row can't be
// physically deleted (audit_logs/payments/tests FK to auth.users NO ACTION), so
// the route runs the compliance erasure then bans the account via updateUserById.
const performComplianceErasure = vi.fn<(id: string, opts: { dryRun: boolean }) => Promise<Record<string, number>>>(
	async () => ({}),
);
const supabaseUpdateUserById = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction, writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		USER_HARD_DELETE_REQUEST: "user_hard_delete_request",
		USER_HARD_DELETE_DONE: "user_hard_delete_done",
	},
}));
vi.mock("@/lib/admin/auth", () => ({ verifyAdminTotpIfConfigured, consumeAdminTotp }));
vi.mock("@/lib/admin/feature-flags", () => ({ isAdminTotpRequired }));
vi.mock("@/lib/admin/rate-limit-action", () => ({
	consumeAdminActionRateLimit,
	adminActionScope: ({ jti }: { jti?: string }) => `jti:${jti ?? "anon"}`,
}));
vi.mock("@/lib/admin/users-list", () => ({ adminGetUserById }));
vi.mock("@/lib/compliance/erasure", () => ({ performComplianceErasure }));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => ({
		auth: { admin: { updateUserById: supabaseUpdateUserById } },
	}),
}));

const VALID_UUID = "33333333-3333-4333-8333-333333333333";

describe("D32 Sprint A · POST /api/admin/users/[id]/hard-delete", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		writeAdminActionStrict.mockClear();
		adminGetUserById.mockReset();
		consumeAdminActionRateLimit.mockClear();
		consumeAdminActionRateLimit.mockResolvedValue({
			allowed: true,
			remaining: 2,
			resetAt: new Date(Date.now() + 60_000),
			degraded: false,
		});
		performComplianceErasure.mockClear();
		performComplianceErasure.mockResolvedValue({});
		supabaseUpdateUserById.mockClear();
		supabaseUpdateUserById.mockResolvedValue({ error: null });
		isAdminTotpRequired.mockResolvedValue(false);
		verifyAdminTotpIfConfigured.mockReturnValue(true);
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/users/[id]/hard-delete/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/hard-delete`, {
				body: { confirm_email: "x@example.com" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects invalid UUID", async () => {
		const { POST } = await import("@/app/api/admin/users/[id]/hard-delete/route");
		const res = await POST(
			adminRequest("/api/admin/users/bad/hard-delete", { body: { confirm_email: "a@b.c" } }),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects unknown body keys (D14 .strict() schema)", async () => {
		adminGetUserById.mockResolvedValue({ email: "u@example.com", full_name: "U" });
		const { POST } = await import("@/app/api/admin/users/[id]/hard-delete/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/hard-delete`, {
				body: { confirm_email: "u@example.com", extraneous: "field" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
		expect(performComplianceErasure).not.toHaveBeenCalled();
	});

	it("404 when target user not found", async () => {
		adminGetUserById.mockResolvedValue(null);
		const { POST } = await import("@/app/api/admin/users/[id]/hard-delete/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/hard-delete`, {
				body: { confirm_email: "x@example.com" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("rejects when confirm_email doesn't match the user's email", async () => {
		adminGetUserById.mockResolvedValue({ email: "real@example.com", full_name: null });
		const { POST } = await import("@/app/api/admin/users/[id]/hard-delete/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/hard-delete`, {
				body: { confirm_email: "guessed@example.com" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
		expect(performComplianceErasure).not.toHaveBeenCalled();
	});

	it("requires TOTP when totpRequired=true (401 without it)", async () => {
		adminGetUserById.mockResolvedValue({ email: "u@example.com", full_name: "U" });
		isAdminTotpRequired.mockResolvedValueOnce(true);
		verifyAdminTotpIfConfigured.mockReturnValueOnce(false);
		const { POST } = await import("@/app/api/admin/users/[id]/hard-delete/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/hard-delete`, {
				body: { confirm_email: "u@example.com" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
		expect(performComplianceErasure).not.toHaveBeenCalled();
	});

	it("429 when rate limit hit; writes a best-effort audit row", async () => {
		adminGetUserById.mockResolvedValue({ email: "u@example.com", full_name: "U" });
		consumeAdminActionRateLimit.mockResolvedValueOnce({
			allowed: false,
			remaining: 0,
			resetAt: new Date(Date.now() + 30_000),
			degraded: false,
		});
		const { POST } = await import("@/app/api/admin/users/[id]/hard-delete/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/hard-delete`, {
				body: { confirm_email: "u@example.com" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(429);
		expect(res.headers.get("Retry-After")).toBeTruthy();
		expect(performComplianceErasure).not.toHaveBeenCalled();
	});

	it("happy path: erase + ban (no physical auth delete) + strict pre/post audit", async () => {
		adminGetUserById.mockResolvedValue({ email: "u@example.com", full_name: "User" });
		const { POST } = await import("@/app/api/admin/users/[id]/hard-delete/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/hard-delete`, {
				body: { confirm_email: "u@example.com" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		// Erase, then ban the auth account — the auth row is NOT physically deleted.
		expect(performComplianceErasure).toHaveBeenCalledWith(VALID_UUID, { dryRun: false });
		expect(supabaseUpdateUserById).toHaveBeenCalledWith(
			VALID_UUID,
			expect.objectContaining({ ban_duration: expect.any(String) }),
		);
		// Two strict audits: pre (request) + post (done).
		const strictActions = writeAdminActionStrict.mock.calls.map(
			(c) => (c[0] as unknown as { action: string }).action,
		);
		expect(strictActions).toContain("user_hard_delete_request");
		expect(strictActions).toContain("user_hard_delete_done");
	});

	it("500 + no ban when erasure fails (fail-closed)", async () => {
		adminGetUserById.mockResolvedValue({ email: "u@example.com", full_name: "User" });
		performComplianceErasure.mockRejectedValueOnce(new Error("db down"));
		const { POST } = await import("@/app/api/admin/users/[id]/hard-delete/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/hard-delete`, {
				body: { confirm_email: "u@example.com" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(500);
		expect(supabaseUpdateUserById).not.toHaveBeenCalled();
	});
});
