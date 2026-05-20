import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/jobs/queue-names", () => ({
	BULK_TRACKER_QUEUE: "bulk_tracker",
	HEALTH_QUEUE: "health",
	INTEGRITY_QUEUE: "integrity",
}));

describe("D32 Sprint C · GET /api/admin/jobs/schedules", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/jobs/schedules/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("happy path returns hardcoded schedule list", async () => {
		const { GET } = await import("@/app/api/admin/jobs/schedules/route");
		const res = await GET();
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: Array<{ id: string; queue: string }> };
		expect(Array.isArray(body.data)).toBe(true);
		expect(body.data.length).toBeGreaterThan(0);
		// At least one entry mentions the pg_cron infra so the contract is captured.
		expect(body.data.some((r) => r.id.includes("operator-process-jobs"))).toBe(true);
	});
});
