import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);

const updateEqOk = vi.fn(async () => ({ data: null, error: null as { message?: string } | null }));
const selectMaybeSingle = vi.fn(async () => ({
	data: null as { paused_at?: string | null; accumulated_pause_seconds?: number | null } | null,
	error: null as { message?: string } | null,
}));

const createServiceRoleClient = vi.fn(() => ({
	from: () => ({
		select: () => ({
			eq: () => ({ maybeSingle: selectMaybeSingle }),
		}),
		update: () => ({ eq: updateEqOk }),
	}),
}));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TEST_PAUSE: "test_pause", TEST_RESUME: "test_resume" },
}));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient }));

describe("D32 Sprint C · tests/[id] pause + resume", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		updateEqOk.mockClear();
		updateEqOk.mockResolvedValue({ data: null, error: null });
		selectMaybeSingle.mockReset();
		selectMaybeSingle.mockResolvedValue({ data: null, error: null });
	});

	it("pause: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/tests/[id]/pause/route");
		const res = await POST(adminRequest("/api/admin/tests/t1/pause", { method: "POST" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(401);
	});

	it("pause: happy path audits", async () => {
		const { POST } = await import("@/app/api/admin/tests/[id]/pause/route");
		const res = await POST(adminRequest("/api/admin/tests/t1/pause", { method: "POST" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("test_pause");
	});

	it("pause: 500 when supabase update errors", async () => {
		updateEqOk.mockResolvedValueOnce({ data: null, error: { message: "rls" } });
		const { POST } = await import("@/app/api/admin/tests/[id]/pause/route");
		const res = await POST(adminRequest("/api/admin/tests/t1/pause", { method: "POST" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(500);
	});

	it("resume: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/tests/[id]/resume/route");
		const res = await POST(adminRequest("/api/admin/tests/t1/resume", { method: "POST" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(401);
	});

	it("resume: 404 when row missing", async () => {
		selectMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
		const { POST } = await import("@/app/api/admin/tests/[id]/resume/route");
		const res = await POST(adminRequest("/api/admin/tests/t1/resume", { method: "POST" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(404);
	});

	it("resume: happy path accumulates pause + audits", async () => {
		const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
		selectMaybeSingle.mockResolvedValueOnce({
			data: { paused_at: tenSecondsAgo, accumulated_pause_seconds: 30 },
			error: null,
		});
		const { POST } = await import("@/app/api/admin/tests/[id]/resume/route");
		const res = await POST(adminRequest("/api/admin/tests/t1/resume", { method: "POST" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { accumulated_pause_seconds: number };
		};
		expect(audit.action).toBe("test_resume");
		// Accumulated 30s plus elapsed ~10s; allow ±2s slack.
		expect(audit.payload.accumulated_pause_seconds).toBeGreaterThanOrEqual(40);
		expect(audit.payload.accumulated_pause_seconds).toBeLessThanOrEqual(42);
	});
});
