import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const adminListPendingTeachers = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/teachers-pending-list", () => ({ adminListPendingTeachers }));

describe("D32 Sprint C · GET /api/admin/teachers/pending", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		adminListPendingTeachers.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/teachers/pending/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("happy path returns list", async () => {
		adminListPendingTeachers.mockResolvedValueOnce([{ id: "t1" }, { id: "t2" }]);
		const { GET } = await import("@/app/api/admin/teachers/pending/route");
		const res = await GET();
		expect(res.status).toBe(200);
		expect(adminListPendingTeachers).toHaveBeenCalled();
	});
});
