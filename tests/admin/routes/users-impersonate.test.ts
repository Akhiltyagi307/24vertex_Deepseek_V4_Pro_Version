import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const adminGetUserById = vi.fn<(id: string) => Promise<{ email: string } | null>>();
const consumeAdminActionRateLimit = vi.fn(async () => ({
	allowed: true,
	remaining: 4,
	resetAt: new Date(Date.now() + 60_000),
	degraded: false,
}));
const generateLink = vi.fn(async () => ({
	data: { properties: { action_link: "https://24vertex.app/magic-link/abc" } },
	error: null as { message: string } | null,
}));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction, writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { IMPERSONATE: "impersonate" },
}));
vi.mock("@/lib/admin/constants", () => ({
	ADMIN_IMPERSONATION_COOKIE: "edu_admin_impersonating",
}));
vi.mock("@/lib/admin/rate-limit-action", () => ({
	consumeAdminActionRateLimit,
	adminActionScope: ({ jti }: { jti?: string }) => `jti:${jti ?? "anon"}`,
}));
vi.mock("@/lib/admin/users-list", () => ({ adminGetUserById }));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => ({
		auth: { admin: { generateLink } },
	}),
}));

const VALID_UUID = "44444444-4444-4444-8444-444444444444";

describe("D32 Sprint A · POST /api/admin/users/[id]/impersonate", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		writeAdminActionStrict.mockClear();
		adminGetUserById.mockReset();
		consumeAdminActionRateLimit.mockClear();
		consumeAdminActionRateLimit.mockResolvedValue({
			allowed: true,
			remaining: 4,
			resetAt: new Date(Date.now() + 60_000),
			degraded: false,
		});
		generateLink.mockClear();
		generateLink.mockResolvedValue({
			data: { properties: { action_link: "https://24vertex.app/magic-link/abc" } },
			error: null,
		});
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/users/[id]/impersonate/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/impersonate`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
		expect(generateLink).not.toHaveBeenCalled();
	});

	it("rejects invalid UUID", async () => {
		const { POST } = await import("@/app/api/admin/users/[id]/impersonate/route");
		const res = await POST(
			adminRequest("/api/admin/users/bad/impersonate"),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when target has no auth email", async () => {
		adminGetUserById.mockResolvedValueOnce(null);
		const { POST } = await import("@/app/api/admin/users/[id]/impersonate/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/impersonate`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(404);
		expect(generateLink).not.toHaveBeenCalled();
	});

	it("429 when rate-limited; magic link not generated", async () => {
		adminGetUserById.mockResolvedValue({ email: "user@example.com" });
		consumeAdminActionRateLimit.mockResolvedValueOnce({
			allowed: false,
			remaining: 0,
			resetAt: new Date(Date.now() + 30_000),
			degraded: false,
		});
		const { POST } = await import("@/app/api/admin/users/[id]/impersonate/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/impersonate`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(429);
		expect(generateLink).not.toHaveBeenCalled();
	});

	it("500 when Supabase generateLink errors out", async () => {
		adminGetUserById.mockResolvedValue({ email: "user@example.com" });
		generateLink.mockResolvedValueOnce({
			data: { properties: { action_link: "" } },
			error: { message: "boom" },
		});
		const { POST } = await import("@/app/api/admin/users/[id]/impersonate/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/impersonate`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(500);
		expect(writeAdminActionStrict).not.toHaveBeenCalled();
	});

	it("happy path: returns magic_link + sets impersonation cookie + strict audit", async () => {
		adminGetUserById.mockResolvedValue({ email: "user@example.com" });
		const { POST } = await import("@/app/api/admin/users/[id]/impersonate/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/impersonate`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean; magic_link?: string };
		expect(body.magic_link).toMatch(/^https?:\/\//);
		const setCookie = res.headers.get("set-cookie");
		expect(setCookie).toContain("edu_admin_impersonating=1");
		expect(writeAdminActionStrict).toHaveBeenCalledTimes(1);
		const auditCall = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(auditCall.action).toBe("impersonate");
		expect(auditCall.targetId).toBe(VALID_UUID);
	});
});
