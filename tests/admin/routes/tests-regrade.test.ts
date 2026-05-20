import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const adminRegradeTest = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TEST_REGRADE: "test_regrade" },
}));
vi.mock("@/lib/admin/grading/regrade", () => ({ adminRegradeTest }));

describe("D32 Sprint C · POST /api/admin/tests/[id]/regrade", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		adminRegradeTest.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/tests/[id]/regrade/route");
		const res = await POST(adminRequest("/api/admin/tests/t1/regrade", { method: "POST" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(401);
	});

	it("400 when regrade returns not-ok", async () => {
		adminRegradeTest.mockResolvedValueOnce({ ok: false, message: "not gradable" });
		const { POST } = await import("@/app/api/admin/tests/[id]/regrade/route");
		const res = await POST(adminRequest("/api/admin/tests/t1/regrade", { method: "POST" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(400);
		expect(writeAdminActionStrict).not.toHaveBeenCalled();
	});

	it("happy path: regrade + strict audit", async () => {
		adminRegradeTest.mockResolvedValueOnce({ ok: true });
		const { POST } = await import("@/app/api/admin/tests/[id]/regrade/route");
		const res = await POST(adminRequest("/api/admin/tests/t1/regrade", { method: "POST" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(200);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("test_regrade");
		expect(audit.targetId).toBe("t1");
	});
});
