import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const insertOperatorJobQueued = vi.fn(async () => {});
const writeBulkReinitJob = vi.fn(async () => {});
const triggerOperatorJobsProcessInBackground = vi.fn(async () => ({ ok: true }));
const runBulkReinitTrackersByGrade = vi.fn(async () => {});

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { PERFORMANCE_BULK_REINIT: "performance_bulk_reinit" },
}));
vi.mock("@/lib/admin/bulk-reinit-job", () => ({
	writeBulkReinitJob,
	runBulkReinitTrackersByGrade,
}));
vi.mock("@/lib/admin/operator-worker-trigger", () => ({
	triggerOperatorJobsProcessInBackground,
}));
vi.mock("@/lib/jobs/operator-job-mirror", () => ({ insertOperatorJobQueued }));
vi.mock("@/lib/jobs/queue-names", () => ({ BULK_TRACKER_QUEUE: "bulk_tracker" }));
vi.mock("@/lib/server/log-supabase-error", () => ({ logServerError: vi.fn() }));

describe("D32 Sprint B · POST /api/admin/performance/jobs/bulk-reinit", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		insertOperatorJobQueued.mockClear();
		insertOperatorJobQueued.mockResolvedValue(undefined);
		writeBulkReinitJob.mockClear();
		triggerOperatorJobsProcessInBackground.mockClear();
		triggerOperatorJobsProcessInBackground.mockResolvedValue({ ok: true });
		runBulkReinitTrackersByGrade.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/performance/jobs/bulk-reinit/route");
		const res = await POST(
			adminRequest("/api/admin/performance/jobs/bulk-reinit", { body: { grade: 10 } }),
		);
		expect(res.status).toBe(401);
	});

	it("rejects grade out of range", async () => {
		const { POST } = await import("@/app/api/admin/performance/jobs/bulk-reinit/route");
		const res = await POST(
			adminRequest("/api/admin/performance/jobs/bulk-reinit", { body: { grade: 0 } }),
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/performance/jobs/bulk-reinit/route");
		const res = await POST(
			adminRequest("/api/admin/performance/jobs/bulk-reinit", {
				body: { grade: 10, extraneous: "x" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("dry_run returns ack without queuing job", async () => {
		const { POST } = await import("@/app/api/admin/performance/jobs/bulk-reinit/route");
		const res = await POST(
			adminRequest("/api/admin/performance/jobs/bulk-reinit", {
				body: { grade: 10, dry_run: true },
			}),
		);
		expect(res.status).toBe(200);
		expect(insertOperatorJobQueued).not.toHaveBeenCalled();
		expect(writeAdminAction).not.toHaveBeenCalled();
	});

	it("503 when operator jobs table unavailable", async () => {
		insertOperatorJobQueued.mockRejectedValueOnce(new Error("relation does not exist"));
		const { POST } = await import("@/app/api/admin/performance/jobs/bulk-reinit/route");
		const res = await POST(
			adminRequest("/api/admin/performance/jobs/bulk-reinit", { body: { grade: 10 } }),
		);
		expect(res.status).toBe(503);
	});

	it("happy path: queues job + audits with grade", async () => {
		const { POST } = await import("@/app/api/admin/performance/jobs/bulk-reinit/route");
		const res = await POST(
			adminRequest("/api/admin/performance/jobs/bulk-reinit", { body: { grade: 11 } }),
		);
		expect(res.status).toBe(200);
		expect(insertOperatorJobQueued).toHaveBeenCalledTimes(1);
		expect(writeBulkReinitJob).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { grade: number };
		};
		expect(audit.action).toBe("performance_bulk_reinit");
		expect(audit.payload.grade).toBe(11);
	});

	it("falls back to inline run when background trigger fails", async () => {
		triggerOperatorJobsProcessInBackground.mockResolvedValueOnce({ ok: false });
		const { POST } = await import("@/app/api/admin/performance/jobs/bulk-reinit/route");
		const res = await POST(
			adminRequest("/api/admin/performance/jobs/bulk-reinit", { body: { grade: 7 } }),
		);
		expect(res.status).toBe(200);
		expect(runBulkReinitTrackersByGrade).toHaveBeenCalled();
	});
});
