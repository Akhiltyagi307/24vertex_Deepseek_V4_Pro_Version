import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const maybeSingle = vi.fn();
const updateEq = vi.fn(async () => ({ error: null as { message: string } | null }));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TEST_EXTEND_TIMER: "test_extend_timer" },
}));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => ({
		from: () => ({
			select: () => ({
				eq: () => ({ maybeSingle }),
			}),
			update: () => ({ eq: updateEq }),
		}),
	}),
}));

const TEST_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

describe("D32 Sprint B · POST /api/admin/tests/[id]/extend", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		maybeSingle.mockReset();
		updateEq.mockClear();
		updateEq.mockResolvedValue({ error: null });
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/tests/[id]/extend/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/extend`, { body: { minutes: 30 } }),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects minutes out of range", async () => {
		const { POST } = await import("@/app/api/admin/tests/[id]/extend/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/extend`, { body: { minutes: 999 } }),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/tests/[id]/extend/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/extend`, {
				body: { minutes: 10, extraneous: "x" },
			}),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when test not found", async () => {
		maybeSingle.mockResolvedValueOnce({ data: null, error: null });
		const { POST } = await import("@/app/api/admin/tests/[id]/extend/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/extend`, { body: { minutes: 10 } }),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(404);
	});

	it("happy path: bumps time_limit + audits", async () => {
		maybeSingle.mockResolvedValueOnce({
			data: { time_limit_seconds: 600, admin_extensions: 1 },
			error: null,
		});
		const { POST } = await import("@/app/api/admin/tests/[id]/extend/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/extend`, { body: { minutes: 10 } }),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { minutes: number; new_time_limit_seconds: number };
		};
		expect(audit.action).toBe("test_extend_timer");
		expect(audit.payload.minutes).toBe(10);
		expect(audit.payload.new_time_limit_seconds).toBe(1200);
	});
});
