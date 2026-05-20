import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const selectLimit = vi.fn();
const updateWhere = vi.fn(async () => undefined);
const txSelectLimit = vi.fn();
const txRedemptionsWhere = vi.fn();
const txDeleteWhere = vi.fn(async () => undefined);
const transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
	cb({
		select: vi.fn(() => ({
			from: () => ({ where: () => ({ limit: txSelectLimit }) }),
		})),
		delete: () => ({ where: txDeleteWhere }),
	}),
);

let txCall = 0;

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction, writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		COUPON_DISABLE: "coupon_disable",
		COUPON_DELETE: "coupon_delete",
	},
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		update: () => ({ set: () => ({ where: updateWhere }) }),
		transaction,
	},
}));

describe("D32 Sprint C · coupons/[code]/disable + /delete", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		writeAdminActionStrict.mockClear();
		selectLimit.mockReset();
		updateWhere.mockClear();
		transaction.mockClear();
		txSelectLimit.mockReset();
		txRedemptionsWhere.mockReset();
		txDeleteWhere.mockClear();
		txCall = 0;
	});

	it("disable: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/coupons/[code]/disable/route");
		const res = await POST(
			adminRequest("/api/admin/coupons/TEST10/disable"),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(401);
	});

	it("disable: 404 when coupon not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/coupons/[code]/disable/route");
		const res = await POST(
			adminRequest("/api/admin/coupons/TEST10/disable"),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(404);
	});

	it("disable: happy path sets isActive=false + audits", async () => {
		selectLimit.mockResolvedValueOnce([{ id: "c1", code: "TEST10" }]);
		const { POST } = await import("@/app/api/admin/coupons/[code]/disable/route");
		const res = await POST(
			adminRequest("/api/admin/coupons/TEST10/disable"),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(200);
		expect(updateWhere).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("coupon_disable");
		expect(audit.targetId).toBe("c1");
	});

	it("delete: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/coupons/[code]/delete/route");
		const res = await POST(
			adminRequest("/api/admin/coupons/TEST10/delete"),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(401);
	});

	it("delete: 404 when coupon not found", async () => {
		// transaction callback yields its own select; route lookup returns no row.
		txSelectLimit.mockResolvedValueOnce([]);
		// Reroute transaction to provide select returning empty rows
		transaction.mockImplementationOnce(async (cb) =>
			cb({
				select: () => ({
					from: () => ({ where: () => ({ limit: txSelectLimit }) }),
				}),
				delete: () => ({ where: txDeleteWhere }),
			}),
		);
		const { POST } = await import("@/app/api/admin/coupons/[code]/delete/route");
		const res = await POST(
			adminRequest("/api/admin/coupons/TEST10/delete"),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(404);
	});

	it("delete: happy path captures + strict audit + deletes", async () => {
		// Two selects inside the transaction: coupon row, then redemptions.
		transaction.mockImplementationOnce(async (cb) =>
			cb({
				select: vi.fn(() => {
					txCall += 1;
					if (txCall === 1) {
						return {
							from: () => ({
								where: () => ({
									limit: vi.fn(async () => [
										{
											id: "c1",
											code: "TEST10",
											kind: "entitlement",
											grantsPlanCode: "pro_monthly",
											discountPercent: null,
											redemptionsCount: 0,
											maxRedemptions: 100,
										},
									]),
								}),
							}),
						};
					}
					// Second select — redemptions
					return {
						from: () => ({
							where: vi.fn(async () => []),
						}),
					};
				}),
				delete: () => ({ where: txDeleteWhere }),
			}),
		);
		const { POST } = await import("@/app/api/admin/coupons/[code]/delete/route");
		const res = await POST(
			adminRequest("/api/admin/coupons/TEST10/delete"),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(200);
		expect(txDeleteWhere).toHaveBeenCalled();
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("coupon_delete");
		expect(audit.targetId).toBe("c1");
	});
});
