import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);

const detailLimit = vi.fn();
const listOffset = vi.fn();
const countWhere = vi.fn();
let nextSelect: "detail" | "list" | "count" = "detail";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn((sel?: unknown) => {
			if (sel && typeof sel === "object" && "total" in (sel as object)) {
				nextSelect = "count";
			}
			if (nextSelect === "count") {
				nextSelect = "detail";
				return {
					from: () => ({
						innerJoin: () => ({
							leftJoin: () => ({
								where: countWhere,
								$dynamic: () => ({ where: countWhere }),
							}),
						}),
					}),
				};
			}
			if (nextSelect === "list") {
				return {
					from: () => ({
						innerJoin: () => ({
							leftJoin: () => {
								const builder = {
									$dynamic: () => builder,
									where: () => builder,
									orderBy: () => ({ limit: () => ({ offset: listOffset }) }),
									limit: () => ({ offset: listOffset }),
								};
								return builder;
							},
						}),
					}),
				};
			}
			return {
				from: () => ({
					innerJoin: () => ({
						leftJoin: () => ({ where: () => ({ limit: detailLimit }) }),
					}),
				}),
			};
		}),
	},
}));

const PAY_UUID = "11112222-3333-4444-8555-666677778888";

describe("D32 Sprint C · /api/admin/payments (list + detail)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		detailLimit.mockReset();
		listOffset.mockReset();
		countWhere.mockReset();
		countWhere.mockResolvedValue([{ total: 0 }]);
		nextSelect = "detail";
	});

	it("list GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		nextSelect = "list";
		const { GET } = await import("@/app/api/admin/payments/route");
		const res = await GET(adminRequest("/api/admin/payments"));
		expect(res.status).toBe(401);
	});

	it("list GET: returns paginated rows", async () => {
		nextSelect = "list";
		listOffset.mockResolvedValueOnce([
			{
				id: "pay-1",
				razorpayPaymentId: "rzp_pay_x",
				profileId: "stu-1",
				amountPaise: 1000,
				status: "captured",
				capturedAt: new Date(),
				refundedAt: null,
				razorpayRefundId: null,
				fullName: "U",
				email: "u@x.com",
				createdAt: new Date(),
			},
		]);
		countWhere.mockResolvedValueOnce([{ total: 1 }]);
		const { GET } = await import("@/app/api/admin/payments/route");
		const res = await GET(adminRequest("/api/admin/payments?q=rzp"));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string }[]; total: number };
		expect(body.data).toHaveLength(1);
		expect(body.total).toBe(1);
	});

	it("detail GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/payments/[id]/route");
		const res = await GET(adminRequest(`/api/admin/payments/${PAY_UUID}`), {
			params: Promise.resolve({ id: PAY_UUID }),
		});
		expect(res.status).toBe(401);
	});

	it("detail GET: 400 when UUID invalid", async () => {
		const { GET } = await import("@/app/api/admin/payments/[id]/route");
		const res = await GET(adminRequest("/api/admin/payments/bad"), {
			params: Promise.resolve({ id: "bad" }),
		});
		expect(res.status).toBe(400);
	});

	it("detail GET: 404 when not found", async () => {
		detailLimit.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/payments/[id]/route");
		const res = await GET(adminRequest(`/api/admin/payments/${PAY_UUID}`), {
			params: Promise.resolve({ id: PAY_UUID }),
		});
		expect(res.status).toBe(404);
	});

	it("detail GET: happy path returns serialized payment", async () => {
		detailLimit.mockResolvedValueOnce([
			{
				p: {
					id: PAY_UUID,
					subscriptionId: null,
					profileId: "stu-1",
					razorpayPaymentId: "rzp_x",
					razorpayInvoiceId: null,
					razorpayOrderId: null,
					amountPaise: 1000,
					currency: "INR",
					status: "captured",
					method: "card",
					invoiceShortUrl: null,
					capturedAt: new Date(),
					metadata: {},
					createdAt: new Date(),
					razorpayRefundId: null,
					refundAmountPaise: null,
					refundedAt: null,
				},
				fullName: "User",
				email: "u@x.com",
			},
		]);
		const { GET } = await import("@/app/api/admin/payments/[id]/route");
		const res = await GET(adminRequest(`/api/admin/payments/${PAY_UUID}`), {
			params: Promise.resolve({ id: PAY_UUID }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string; amount_paise: number } };
		expect(body.data.id).toBe(PAY_UUID);
		expect(body.data.amount_paise).toBe(1000);
	});
});
