import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const getAdminDashboardMetrics = vi.fn<() => Promise<Record<string, unknown> | null>>();
const metricToNumber = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/dashboard-metrics", () => ({ getAdminDashboardMetrics, metricToNumber }));

describe("D32 Sprint C · GET /api/admin/dashboard/metrics", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		getAdminDashboardMetrics.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/dashboard/metrics/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("503 when metrics row unavailable", async () => {
		getAdminDashboardMetrics.mockResolvedValueOnce(null);
		const { GET } = await import("@/app/api/admin/dashboard/metrics/route");
		const res = await GET();
		expect(res.status).toBe(503);
	});

	it("happy path: returns shaped metrics", async () => {
		getAdminDashboardMetrics.mockResolvedValueOnce({
			total_students: 1000,
			active_24h: 200,
			tests_submitted_today: 50,
			tests_in_progress: 5,
			active_subscriptions: 30,
			mrr_inr: 50000,
			pending_teacher_approvals: 2,
			stuck_webhooks: 0,
			open_dsrs: 1,
			open_mod_flags: 3,
			failed_jobs_24h: 0,
			computed_at: new Date(),
		});
		const { GET } = await import("@/app/api/admin/dashboard/metrics/route");
		const res = await GET();
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { total_students: number; mrr_inr: number } };
		expect(body.data.total_students).toBe(1000);
		expect(body.data.mrr_inr).toBe(50000);
	});
});
