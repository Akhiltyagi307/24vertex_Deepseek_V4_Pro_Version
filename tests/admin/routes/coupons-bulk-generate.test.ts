import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const planSelectLimit = vi.fn();
const couponsInsert = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { COUPON_BULK_GENERATE: "coupon_bulk_generate" },
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: planSelectLimit }) }) }),
		insert: () => ({ values: couponsInsert }),
	},
}));

describe("D32 Sprint C · POST /api/admin/coupons/bulk-generate", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		planSelectLimit.mockReset();
		couponsInsert.mockClear();
		couponsInsert.mockResolvedValue(undefined);
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/coupons/bulk-generate/route");
		const res = await POST(
			adminRequest("/api/admin/coupons/bulk-generate", {
				body: { count: 5, grants_plan_code: "pro_monthly" },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("rejects count > 200", async () => {
		const { POST } = await import("@/app/api/admin/coupons/bulk-generate/route");
		const res = await POST(
			adminRequest("/api/admin/coupons/bulk-generate", {
				body: { count: 9999, grants_plan_code: "pro_monthly" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/coupons/bulk-generate/route");
		const res = await POST(
			adminRequest("/api/admin/coupons/bulk-generate", {
				body: { count: 3, grants_plan_code: "pro_monthly", extraneous: "x" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("400 when grants_plan_code not found", async () => {
		planSelectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/coupons/bulk-generate/route");
		const res = await POST(
			adminRequest("/api/admin/coupons/bulk-generate", {
				body: { count: 3, grants_plan_code: "ghost_plan" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("happy path: generates N codes + audits", async () => {
		planSelectLimit.mockResolvedValueOnce([{ code: "pro_monthly" }]);
		const { POST } = await import("@/app/api/admin/coupons/bulk-generate/route");
		const res = await POST(
			adminRequest("/api/admin/coupons/bulk-generate", {
				body: { count: 5, grants_plan_code: "pro_monthly", code_prefix: "GIFT" },
			}),
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as { ok: boolean; codes: string[] };
		expect(body.codes).toHaveLength(5);
		expect(body.codes[0]).toMatch(/^GIFT-/);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { count: number; prefix: string };
		};
		expect(audit.action).toBe("coupon_bulk_generate");
		expect(audit.payload.count).toBe(5);
		expect(audit.payload.prefix).toBe("GIFT");
	});
});
