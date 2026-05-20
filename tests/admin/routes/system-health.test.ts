import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const dbExecute = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/db", () => ({
	db: { execute: dbExecute },
}));

describe("D32 Sprint C · GET /api/admin/system/health", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		dbExecute.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/system/health/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("returns latest service health ping per provider", async () => {
		dbExecute.mockResolvedValueOnce([
			{
				provider: "supabase",
				status: "ok",
				latency_ms: 42,
				error: null,
				checked_at: new Date().toISOString(),
			},
			{
				provider: "razorpay",
				status: "degraded",
				latency_ms: 220,
				error: "timeout",
				checked_at: new Date().toISOString(),
			},
		]);
		const { GET } = await import("@/app/api/admin/system/health/route");
		const res = await GET();
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { provider: string; status: string }[] };
		expect(body.data).toHaveLength(2);
		expect(body.data.map((d) => d.provider)).toContain("supabase");
	});

	it("returns empty array when no pings recorded", async () => {
		dbExecute.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/system/health/route");
		const res = await GET();
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown[] };
		expect(body.data).toEqual([]);
	});
});
