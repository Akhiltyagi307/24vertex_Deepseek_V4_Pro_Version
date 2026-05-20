import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});

const selectLimit = vi.fn();
const updateWhere = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { PLAN_PATCH: "plan_patch" },
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		update: () => ({ set: () => ({ where: updateWhere }) }),
	},
}));

describe("D32 Sprint B · /api/admin/plans/[code] (GET + PATCH)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		selectLimit.mockReset();
		updateWhere.mockClear();
	});

	it("GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/plans/[code]/route");
		const res = await GET(adminRequest("/api/admin/plans/pro_monthly"), {
			params: Promise.resolve({ code: "pro_monthly" }),
		});
		expect(res.status).toBe(401);
	});

	it("GET: 404 when plan not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/plans/[code]/route");
		const res = await GET(adminRequest("/api/admin/plans/pro_monthly"), {
			params: Promise.resolve({ code: "pro_monthly" }),
		});
		expect(res.status).toBe(404);
	});

	it("PATCH: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { PATCH } = await import("@/app/api/admin/plans/[code]/route");
		const res = await PATCH(
			adminRequest("/api/admin/plans/pro_monthly", { body: { is_active: true } }),
			{ params: Promise.resolve({ code: "pro_monthly" }) },
		);
		expect(res.status).toBe(401);
	});

	it("PATCH: rejects empty body (no fields)", async () => {
		const { PATCH } = await import("@/app/api/admin/plans/[code]/route");
		const res = await PATCH(
			adminRequest("/api/admin/plans/pro_monthly", { body: {} }),
			{ params: Promise.resolve({ code: "pro_monthly" }) },
		);
		expect(res.status).toBe(400);
	});

	it("PATCH: rejects extra keys (D14 strict)", async () => {
		const { PATCH } = await import("@/app/api/admin/plans/[code]/route");
		const res = await PATCH(
			adminRequest("/api/admin/plans/pro_monthly", {
				body: { is_active: true, extraneous: "x" },
			}),
			{ params: Promise.resolve({ code: "pro_monthly" }) },
		);
		expect(res.status).toBe(400);
	});

	it("PATCH: 404 when plan not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { PATCH } = await import("@/app/api/admin/plans/[code]/route");
		const res = await PATCH(
			adminRequest("/api/admin/plans/pro_monthly", { body: { is_active: true } }),
			{ params: Promise.resolve({ code: "pro_monthly" }) },
		);
		expect(res.status).toBe(404);
	});

	it("PATCH: happy path strict audit", async () => {
		selectLimit
			.mockResolvedValueOnce([{ code: "pro_monthly", isActive: false }])
			.mockResolvedValueOnce([{ code: "pro_monthly", isActive: true }]);
		const { PATCH } = await import("@/app/api/admin/plans/[code]/route");
		const res = await PATCH(
			adminRequest("/api/admin/plans/pro_monthly", { body: { is_active: true, name: "Pro Monthly" } }),
			{ params: Promise.resolve({ code: "pro_monthly" }) },
		);
		expect(res.status).toBe(200);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
			payload: { is_active?: boolean };
		};
		expect(audit.action).toBe("plan_patch");
		expect(audit.targetId).toBe("pro_monthly");
		expect(audit.payload.is_active).toBe(true);
	});
});
