import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const listLimit = vi.fn();
const detailLimit = vi.fn();
const failOperatorJob = vi.fn(async () => {});
const resetOperatorJobForRetry = vi.fn(async () => {});
const triggerOperatorJobsProcessInBackground = vi.fn(async () => ({ ok: true }));
const setOperatorQueuePaused = vi.fn(async () => {});
let nextSelect: "list" | "detail" | "retry-check" = "list";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		OPERATOR_JOB_CANCEL: "operator_job_cancel",
		OPERATOR_JOB_RETRY: "operator_job_retry",
		OPERATOR_QUEUE_PAUSE: "operator_queue_pause",
		OPERATOR_QUEUE_RESUME: "operator_queue_resume",
	},
}));
vi.mock("@/lib/admin/operator-worker-trigger", () => ({ triggerOperatorJobsProcessInBackground }));
vi.mock("@/lib/jobs/operator-job-mirror", () => ({
	failOperatorJob,
	resetOperatorJobForRetry,
}));
vi.mock("@/lib/jobs/operator-queue-pause", () => ({ setOperatorQueuePaused }));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => {
			if (nextSelect === "retry-check") {
				return { from: () => ({ where: () => ({ limit: detailLimit }) }) };
			}
			if (nextSelect === "detail") {
				return { from: () => ({ where: () => ({ limit: detailLimit }) }) };
			}
			return {
				from: () => ({
					where: () => ({ orderBy: () => ({ limit: listLimit }) }),
					orderBy: () => ({ limit: listLimit }),
				}),
			};
		}),
	},
}));

const JOB_ID = "job-1";

describe("D32 Sprint C · jobs list + detail + cancel + retry + queue pause/resume", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		listLimit.mockReset();
		detailLimit.mockReset();
		failOperatorJob.mockClear();
		resetOperatorJobForRetry.mockClear();
		triggerOperatorJobsProcessInBackground.mockClear();
		triggerOperatorJobsProcessInBackground.mockResolvedValue({ ok: true });
		setOperatorQueuePaused.mockClear();
		nextSelect = "list";
	});

	it("list GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/jobs/route");
		const res = await GET(adminRequest("/api/admin/jobs"));
		expect(res.status).toBe(401);
	});

	it("list GET: returns jobs filtered by status", async () => {
		listLimit.mockResolvedValueOnce([{ id: JOB_ID, status: "queued", queue: "bulk_tracker" }]);
		const { GET } = await import("@/app/api/admin/jobs/route");
		const res = await GET(adminRequest("/api/admin/jobs?status=queued&queue=bulk_tracker"));
		expect(res.status).toBe(200);
	});

	it("detail GET: 404 when not found", async () => {
		nextSelect = "detail";
		detailLimit.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/jobs/[id]/route");
		const res = await GET(new Request(`http://localhost/api/admin/jobs/${JOB_ID}`), {
			params: Promise.resolve({ id: JOB_ID }),
		});
		expect(res.status).toBe(404);
	});

	it("cancel POST: 404 when job not found", async () => {
		nextSelect = "detail";
		detailLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/jobs/[id]/cancel/route");
		const res = await POST(adminRequest(`/api/admin/jobs/${JOB_ID}/cancel`), {
			params: Promise.resolve({ id: JOB_ID }),
		});
		expect(res.status).toBe(404);
	});

	it("cancel POST: happy path strict-audits + fails the job", async () => {
		nextSelect = "detail";
		detailLimit.mockResolvedValueOnce([{ id: JOB_ID, queue: "bulk_tracker" }]);
		const { POST } = await import("@/app/api/admin/jobs/[id]/cancel/route");
		const res = await POST(adminRequest(`/api/admin/jobs/${JOB_ID}/cancel`), {
			params: Promise.resolve({ id: JOB_ID }),
		});
		expect(res.status).toBe(200);
		expect(failOperatorJob).toHaveBeenCalledWith(JOB_ID, "cancelled_by_admin");
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("operator_job_cancel");
	});

	it("retry POST: rejects non-failed job", async () => {
		nextSelect = "detail";
		detailLimit.mockResolvedValueOnce([{ id: JOB_ID, status: "queued", queue: "bulk_tracker" }]);
		const { POST } = await import("@/app/api/admin/jobs/[id]/retry/route");
		const res = await POST(adminRequest(`/api/admin/jobs/${JOB_ID}/retry`), {
			params: Promise.resolve({ id: JOB_ID }),
		});
		expect(res.status).toBe(400);
	});

	it("queue pause POST: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/jobs/queues/[name]/pause/route");
		const res = await POST(adminRequest("/api/admin/jobs/queues/bulk_tracker/pause"), {
			params: Promise.resolve({ name: "bulk_tracker" }),
		});
		expect(res.status).toBe(401);
	});

	it("queue pause POST: happy path pauses + strict audit", async () => {
		const { POST } = await import("@/app/api/admin/jobs/queues/[name]/pause/route");
		const res = await POST(adminRequest("/api/admin/jobs/queues/bulk_tracker/pause"), {
			params: Promise.resolve({ name: "bulk_tracker" }),
		});
		expect(res.status).toBe(200);
		expect(setOperatorQueuePaused).toHaveBeenCalledWith("bulk_tracker", true);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("operator_queue_pause");
	});

	it("queue resume POST: happy path resumes + strict audit", async () => {
		const { POST } = await import("@/app/api/admin/jobs/queues/[name]/resume/route");
		const res = await POST(adminRequest("/api/admin/jobs/queues/bulk_tracker/resume"), {
			params: Promise.resolve({ name: "bulk_tracker" }),
		});
		expect(res.status).toBe(200);
		expect(setOperatorQueuePaused).toHaveBeenCalledWith("bulk_tracker", false);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("operator_queue_resume");
	});
});
