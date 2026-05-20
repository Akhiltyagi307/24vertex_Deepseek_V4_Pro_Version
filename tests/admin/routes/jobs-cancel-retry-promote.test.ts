import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const failOperatorJob = vi.fn(async () => undefined);
const resetOperatorJobForRetry = vi.fn(async () => undefined);
const triggerOperatorJobsProcessInBackground = vi.fn();
const selectLimit = vi.fn();
const retrySelectLimit = vi.fn();
let nextSelect: "row" | "retry-status" = "row";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		OPERATOR_JOB_CANCEL: "operator_job_cancel",
		OPERATOR_JOB_RETRY: "operator_job_retry",
	},
}));
vi.mock("@/lib/jobs/operator-job-mirror", () => ({
	failOperatorJob,
	resetOperatorJobForRetry,
}));
vi.mock("@/lib/admin/operator-worker-trigger", () => ({
	triggerOperatorJobsProcessInBackground,
}));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => {
			if (nextSelect === "retry-status") {
				return { from: () => ({ where: () => ({ limit: retrySelectLimit }) }) };
			}
			return { from: () => ({ where: () => ({ limit: selectLimit }) }) };
		}),
	},
}));

describe("D32 Sprint C · jobs/[id] cancel + retry + promote", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		failOperatorJob.mockClear();
		resetOperatorJobForRetry.mockClear();
		triggerOperatorJobsProcessInBackground.mockClear();
		selectLimit.mockReset();
		retrySelectLimit.mockReset();
		nextSelect = "row";
	});

	it("cancel: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/jobs/[id]/cancel/route");
		const res = await POST(adminRequest("/api/admin/jobs/j1/cancel", { method: "POST" }), {
			params: Promise.resolve({ id: "j1" }),
		});
		expect(res.status).toBe(401);
	});

	it("cancel: 404 when job not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/jobs/[id]/cancel/route");
		const res = await POST(adminRequest("/api/admin/jobs/j1/cancel", { method: "POST" }), {
			params: Promise.resolve({ id: "j1" }),
		});
		expect(res.status).toBe(404);
	});

	it("cancel: happy path fails job + strict audit", async () => {
		selectLimit.mockResolvedValueOnce([{ id: "j1", queue: "practice" }]);
		const { POST } = await import("@/app/api/admin/jobs/[id]/cancel/route");
		const res = await POST(adminRequest("/api/admin/jobs/j1/cancel", { method: "POST" }), {
			params: Promise.resolve({ id: "j1" }),
		});
		expect(res.status).toBe(200);
		expect(failOperatorJob).toHaveBeenCalledWith("j1", "cancelled_by_admin");
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("operator_job_cancel");
		expect(audit.targetId).toBe("j1");
	});

	it("retry: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/jobs/[id]/retry/route");
		const res = await POST(adminRequest("/api/admin/jobs/j1/retry", { method: "POST" }), {
			params: Promise.resolve({ id: "j1" }),
		});
		expect(res.status).toBe(401);
	});

	it("retry: 404 when not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/jobs/[id]/retry/route");
		const res = await POST(adminRequest("/api/admin/jobs/j1/retry", { method: "POST" }), {
			params: Promise.resolve({ id: "j1" }),
		});
		expect(res.status).toBe(404);
	});

	it("retry: 400 when job is not failed", async () => {
		selectLimit.mockResolvedValueOnce([{ id: "j1", queue: "practice", status: "queued" }]);
		const { POST } = await import("@/app/api/admin/jobs/[id]/retry/route");
		const res = await POST(adminRequest("/api/admin/jobs/j1/retry", { method: "POST" }), {
			params: Promise.resolve({ id: "j1" }),
		});
		expect(res.status).toBe(400);
	});

	it("promote: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/jobs/[id]/promote/route");
		const res = await POST(adminRequest("/api/admin/jobs/j1/promote", { method: "POST" }), {
			params: Promise.resolve({ id: "j1" }),
		});
		expect(res.status).toBe(401);
	});

	it("promote: 404 when job not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/jobs/[id]/promote/route");
		const res = await POST(adminRequest("/api/admin/jobs/j1/promote", { method: "POST" }), {
			params: Promise.resolve({ id: "j1" }),
		});
		expect(res.status).toBe(404);
	});

	it("promote: unsupported response when job exists", async () => {
		selectLimit.mockResolvedValueOnce([{ id: "j1", queue: "practice" }]);
		const { POST } = await import("@/app/api/admin/jobs/[id]/promote/route");
		const res = await POST(adminRequest("/api/admin/jobs/j1/promote", { method: "POST" }), {
			params: Promise.resolve({ id: "j1" }),
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { code?: string };
		expect(body.code).toBe("promote_unsupported");
	});
});
