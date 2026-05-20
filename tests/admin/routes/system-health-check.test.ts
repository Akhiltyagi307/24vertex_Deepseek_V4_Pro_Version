import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const runAllHealthPings = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { SERVICE_HEALTH_CHECK: "service_health_check" },
}));
vi.mock("@/lib/jobs/health/run-all-health-pings", () => ({ runAllHealthPings }));

describe("D32 Sprint C · POST /api/admin/system/health/[provider]/check", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		runAllHealthPings.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/system/health/[provider]/check/route");
		const res = await POST(adminRequest("/api/admin/system/health/openai/check", { method: "POST" }), {
			params: Promise.resolve({ provider: "openai" }),
		});
		expect(res.status).toBe(401);
	});

	it("happy path: runs pings + audits", async () => {
		const { POST } = await import("@/app/api/admin/system/health/[provider]/check/route");
		const res = await POST(adminRequest("/api/admin/system/health/openai/check", { method: "POST" }), {
			params: Promise.resolve({ provider: "openai" }),
		});
		expect(res.status).toBe(200);
		expect(runAllHealthPings).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("service_health_check");
		expect(audit.targetId).toBe("openai");
	});
});
