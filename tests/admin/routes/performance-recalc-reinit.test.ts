import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const adminRecalculatePerformanceFromReports = vi.fn();
const adminReinitializePerformanceTracker = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		PERFORMANCE_RECALCULATE: "performance_recalculate",
		PERFORMANCE_REINITIALIZE: "performance_reinitialize",
	},
}));
vi.mock("@/lib/admin/performance-admin", () => ({
	adminRecalculatePerformanceFromReports,
	adminReinitializePerformanceTracker,
}));

const STUDENT = "44444444-4444-4444-8444-444444444444";

describe("D32 Sprint C · performance recalculate + reinitialize", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		adminRecalculatePerformanceFromReports.mockReset();
		adminReinitializePerformanceTracker.mockReset();
	});

	it("recalculate: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/performance/[studentId]/recalculate/route");
		const res = await POST(
			adminRequest(`/api/admin/performance/${STUDENT}/recalculate`, { method: "POST" }),
			{ params: Promise.resolve({ studentId: STUDENT }) },
		);
		expect(res.status).toBe(401);
	});

	it("recalculate: 400 when lib returns not-ok", async () => {
		adminRecalculatePerformanceFromReports.mockResolvedValueOnce({ ok: false, message: "no reports" });
		const { POST } = await import("@/app/api/admin/performance/[studentId]/recalculate/route");
		const res = await POST(
			adminRequest(`/api/admin/performance/${STUDENT}/recalculate`, { method: "POST" }),
			{ params: Promise.resolve({ studentId: STUDENT }) },
		);
		expect(res.status).toBe(400);
		expect(writeAdminAction).not.toHaveBeenCalled();
	});

	it("recalculate: happy path audits", async () => {
		adminRecalculatePerformanceFromReports.mockResolvedValueOnce({ ok: true });
		const { POST } = await import("@/app/api/admin/performance/[studentId]/recalculate/route");
		const res = await POST(
			adminRequest(`/api/admin/performance/${STUDENT}/recalculate`, { method: "POST" }),
			{ params: Promise.resolve({ studentId: STUDENT }) },
		);
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("performance_recalculate");
		expect(audit.targetId).toBe(STUDENT);
	});

	it("reinitialize: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/performance/[studentId]/reinitialize/route");
		const res = await POST(
			adminRequest(`/api/admin/performance/${STUDENT}/reinitialize`, { method: "POST" }),
			{ params: Promise.resolve({ studentId: STUDENT }) },
		);
		expect(res.status).toBe(401);
	});

	it("reinitialize: 400 when lib returns not-ok", async () => {
		adminReinitializePerformanceTracker.mockResolvedValueOnce({ ok: false, message: "no profile" });
		const { POST } = await import("@/app/api/admin/performance/[studentId]/reinitialize/route");
		const res = await POST(
			adminRequest(`/api/admin/performance/${STUDENT}/reinitialize`, { method: "POST" }),
			{ params: Promise.resolve({ studentId: STUDENT }) },
		);
		expect(res.status).toBe(400);
	});

	it("reinitialize: happy path audits", async () => {
		adminReinitializePerformanceTracker.mockResolvedValueOnce({ ok: true });
		const { POST } = await import("@/app/api/admin/performance/[studentId]/reinitialize/route");
		const res = await POST(
			adminRequest(`/api/admin/performance/${STUDENT}/reinitialize`, { method: "POST" }),
			{ params: Promise.resolve({ studentId: STUDENT }) },
		);
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("performance_reinitialize");
	});
});
