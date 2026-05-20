import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const adminListLiveTests = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/tests-admin", () => ({ adminListLiveTests }));

describe("D32 Sprint C · GET /api/admin/tests/live", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		adminListLiveTests.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/tests/live/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("happy path returns list", async () => {
		adminListLiveTests.mockResolvedValueOnce([
			{ id: "t1", status: "in_progress" },
			{ id: "t2", status: "in_progress" },
		]);
		const { GET } = await import("@/app/api/admin/tests/live/route");
		const res = await GET();
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: Array<{ id: string }> } | Array<{ id: string }>;
		const rows = Array.isArray(body) ? body : body.data;
		expect(rows).toHaveLength(2);
	});

	it("empty list returns 200", async () => {
		adminListLiveTests.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/tests/live/route");
		const res = await GET();
		expect(res.status).toBe(200);
	});
});
