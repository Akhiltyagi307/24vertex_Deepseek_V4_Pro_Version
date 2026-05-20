import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const readBulkReinitJob = vi.fn();
const selectLimit = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/bulk-reinit-job", () => ({ readBulkReinitJob }));
vi.mock("@/db", () => ({
	db: { select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }) },
}));

describe("D32 Sprint C · GET /api/admin/performance/jobs/bulk-reinit/[jobId]", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		readBulkReinitJob.mockReset();
		selectLimit.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/performance/jobs/bulk-reinit/[jobId]/route");
		const res = await GET(adminRequest("/api/admin/performance/jobs/bulk-reinit/j1"), {
			params: Promise.resolve({ jobId: "j1" }),
		});
		expect(res.status).toBe(401);
	});

	it("404 when no KV state and no mirror row", async () => {
		readBulkReinitJob.mockResolvedValueOnce(null);
		selectLimit.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/performance/jobs/bulk-reinit/[jobId]/route");
		const res = await GET(adminRequest("/api/admin/performance/jobs/bulk-reinit/j1"), {
			params: Promise.resolve({ jobId: "j1" }),
		});
		expect(res.status).toBe(404);
	});

	it("returns KV state when present", async () => {
		readBulkReinitJob.mockResolvedValueOnce({
			status: "running",
			processed: 3,
			total: 10,
			grade: 6,
		});
		selectLimit.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/performance/jobs/bulk-reinit/[jobId]/route");
		const res = await GET(adminRequest("/api/admin/performance/jobs/bulk-reinit/j1"), {
			params: Promise.resolve({ jobId: "j1" }),
		});
		expect(res.status).toBe(200);
	});

	it("falls back to mirror when KV is missing", async () => {
		readBulkReinitJob.mockResolvedValueOnce(null);
		selectLimit.mockResolvedValueOnce([
			{
				id: "j1",
				status: "active",
				payload: { grade: 6 },
				result: { processed: 5, total: 10 },
				error: null,
			},
		]);
		const { GET } = await import("@/app/api/admin/performance/jobs/bulk-reinit/[jobId]/route");
		const res = await GET(adminRequest("/api/admin/performance/jobs/bulk-reinit/j1"), {
			params: Promise.resolve({ jobId: "j1" }),
		});
		expect(res.status).toBe(200);
	});
});
