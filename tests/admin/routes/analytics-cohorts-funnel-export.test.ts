import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const dbExecute = vi.fn();
const getAdminAnalyticsFunnelData = vi.fn(async () => ({
	stages: [{ stage: "signup", n: 100 }],
	events_90d: [{ event: "test_started", n: 50 }],
}));
const listPracticeAnalyticsEventsOrdered = vi.fn(async () => [
	{ id: "evt-1", studentId: "stu-1", eventName: "test_start", occurredAt: new Date(), props: { x: 1 } },
]);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { ANALYTICS_EXPORT: "analytics_export" },
}));
vi.mock("@/lib/admin/analytics/funnel-data", () => ({ getAdminAnalyticsFunnelData }));
vi.mock("@/lib/admin/analytics/export-preview-rows", () => ({
	listPracticeAnalyticsEventsOrdered,
}));
vi.mock("@/db", () => ({ db: { execute: dbExecute } }));

describe("D32 Sprint C · analytics — cohorts + funnel + export", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		dbExecute.mockReset();
		getAdminAnalyticsFunnelData.mockClear();
		listPracticeAnalyticsEventsOrdered.mockClear();
		listPracticeAnalyticsEventsOrdered.mockResolvedValue([
			{ id: "evt-1", studentId: "stu-1", eventName: "test_start", occurredAt: new Date(), props: { x: 1 } },
		]);
	});

	it("cohorts: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/analytics/cohorts/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("cohorts: returns rows in `cohorts` envelope", async () => {
		dbExecute.mockResolvedValueOnce([{ cohort_month: "2026-01-01", cohort_size: 50 }]);
		const { GET } = await import("@/app/api/admin/analytics/cohorts/route");
		const res = await GET();
		expect(res.status).toBe(200);
		const body = (await res.json()) as { cohorts: { cohort_size: number }[] };
		expect(body.cohorts[0]?.cohort_size).toBe(50);
	});

	it("cohorts: 500 envelope on DB error", async () => {
		dbExecute.mockRejectedValueOnce(new Error("db down"));
		const { GET } = await import("@/app/api/admin/analytics/cohorts/route");
		const res = await GET();
		expect(res.status).toBe(500);
	});

	it("funnel: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/analytics/funnel/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("funnel: returns stages + events_90d", async () => {
		const { GET } = await import("@/app/api/admin/analytics/funnel/route");
		const res = await GET();
		expect(res.status).toBe(200);
		const body = (await res.json()) as { stages: unknown[]; events_90d: unknown[] };
		expect(body.stages).toHaveLength(1);
	});

	it("export: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/analytics/export/route");
		const res = await GET(adminRequest("/api/admin/analytics/export"));
		expect(res.status).toBe(401);
	});

	it("export: returns CSV + audits the export (PII trail)", async () => {
		const { GET } = await import("@/app/api/admin/analytics/export/route");
		const res = await GET(adminRequest("/api/admin/analytics/export"));
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/csv");
		expect(res.headers.get("content-disposition")).toContain("attachment");
		expect(writeAdminAction).toHaveBeenCalledTimes(1);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { format: string; row_count: number };
		};
		expect(audit.action).toBe("analytics_export");
		expect(audit.payload.format).toBe("csv");
		expect(audit.payload.row_count).toBe(1);
	});
});
