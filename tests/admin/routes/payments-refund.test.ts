import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn(async () => true);
const writeAdminActionStrict = vi.fn(async () => {});
const consumeAdminActionRateLimit = vi.fn(async () => ({
	allowed: true,
	remaining: 4,
	resetAt: new Date(Date.now() + 60_000),
	degraded: false,
}));
const refundPayment = vi.fn(async () => ({ id: "rfnd_test_1" }));
const isAdminTotpRequired = vi.fn(async () => false);
const verifyAdminTotpIfConfigured = vi.fn(() => true);
const consumeAdminTotp = vi.fn(async () => true);

// db.select() and db.insert()/.update() shapes — drizzle chain mocks.
const paymentsSelectLimit = vi.fn();
const paymentsSelect = vi.fn(() => ({
	from: () => ({ where: () => ({ limit: paymentsSelectLimit }) }),
}));
const idempReserveReturning = vi.fn();
const idempInsert = vi.fn(() => ({
	values: () => ({
		onConflictDoNothing: () => ({ returning: idempReserveReturning }),
	}),
}));
const idempLookupLimit = vi.fn();
const idempSelectFrom = vi.fn(() => ({
	where: () => ({ limit: idempLookupLimit }),
}));
const idempUpdateWhere = vi.fn(async () => undefined);
const paymentsUpdateWhere = vi.fn(async () => undefined);
const dbUpdate = vi.fn(() => ({
	set: () => ({ where: idempUpdateWhere }),
}));
const dbUpdatePayments = vi.fn(() => ({
	set: () => ({ where: paymentsUpdateWhere }),
}));

// `db` is one object that exposes select/insert/update. select() is called
// once for payments and once for idempotency lookup; we route via call count.
let updateCallTarget: "idemp" | "payments" = "idemp";
let selectCallTarget: "payments" | "idemp" = "payments";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/auth", () => ({ consumeAdminTotp, verifyAdminTotpIfConfigured }));
vi.mock("@/lib/admin/feature-flags", () => ({ isAdminTotpRequired }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction, writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { PAYMENT_REFUND: "payment_refund" },
}));
vi.mock("@/lib/admin/rate-limit-action", () => ({
	consumeAdminActionRateLimit,
	adminActionScope: ({ jti }: { jti?: string }) => `jti:${jti ?? "anon"}`,
}));
vi.mock("@/lib/billing/razorpay", () => ({ refundPayment }));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => ({
		rpc: vi.fn(async () => ({ error: null })),
		from: () => ({ insert: vi.fn(async () => ({ error: null })) }),
	}),
}));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => {
			if (selectCallTarget === "payments") return paymentsSelect();
			return idempSelectFrom();
		}),
		insert: idempInsert,
		update: vi.fn(() => {
			if (updateCallTarget === "idemp") return dbUpdate();
			return dbUpdatePayments();
		}),
	},
}));
vi.mock("@/db/schema/billing", () => ({
	payments: {},
	adminRefundIdempotency: { idempotencyKey: "idempotencyKey" },
}));

const VALID_UUID = "55555555-5555-4555-8555-555555555555";

function refundReq(opts: { idempotency?: string; body?: Record<string, unknown> } = {}) {
	return adminRequest(`/api/admin/payments/${VALID_UUID}/refund`, {
		body: opts.body ?? {},
		headers: opts.idempotency !== undefined ? { "idempotency-key": opts.idempotency } : {},
	});
}

describe("D32 Sprint A · POST /api/admin/payments/[id]/refund", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		writeAdminActionStrict.mockClear();
		consumeAdminActionRateLimit.mockClear();
		consumeAdminActionRateLimit.mockResolvedValue({
			allowed: true,
			remaining: 4,
			resetAt: new Date(Date.now() + 60_000),
			degraded: false,
		});
		paymentsSelectLimit.mockReset();
		idempReserveReturning.mockReset();
		idempLookupLimit.mockReset();
		refundPayment.mockClear();
		refundPayment.mockResolvedValue({ id: "rfnd_test_1" });
		isAdminTotpRequired.mockReset();
		isAdminTotpRequired.mockResolvedValue(false);
		verifyAdminTotpIfConfigured.mockReturnValue(true);
		consumeAdminTotp.mockReset();
		consumeAdminTotp.mockResolvedValue(true);
		selectCallTarget = "payments";
		updateCallTarget = "idemp";
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/payments/[id]/refund/route");
		const res = await POST(
			refundReq({ idempotency: "abc" }),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects missing Idempotency-Key header", async () => {
		const { POST } = await import("@/app/api/admin/payments/[id]/refund/route");
		const res = await POST(refundReq(), { params: Promise.resolve({ id: VALID_UUID }) });
		expect(res.status).toBe(400);
		expect(refundPayment).not.toHaveBeenCalled();
	});

	it("rejects invalid payment UUID", async () => {
		const { POST } = await import("@/app/api/admin/payments/[id]/refund/route");
		const res = await POST(
			adminRequest(`/api/admin/payments/bad/refund`, { headers: { "idempotency-key": "x" } }),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("429 when rate-limited", async () => {
		consumeAdminActionRateLimit.mockResolvedValueOnce({
			allowed: false,
			remaining: 0,
			resetAt: new Date(Date.now() + 30_000),
			degraded: false,
		});
		const { POST } = await import("@/app/api/admin/payments/[id]/refund/route");
		const res = await POST(
			refundReq({ idempotency: "abc" }),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(429);
		expect(refundPayment).not.toHaveBeenCalled();
	});

	it("404 when payment row missing", async () => {
		paymentsSelectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/payments/[id]/refund/route");
		const res = await POST(
			refundReq({ idempotency: "abc" }),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(404);
		expect(refundPayment).not.toHaveBeenCalled();
	});

	it("409 when payment already refunded", async () => {
		paymentsSelectLimit.mockResolvedValueOnce([
			{
				id: VALID_UUID,
				razorpayPaymentId: "pay_xyz",
				amountPaise: 1000,
				refundedAt: new Date(),
				razorpayRefundId: null,
			},
		]);
		const { POST } = await import("@/app/api/admin/payments/[id]/refund/route");
		const res = await POST(
			refundReq({ idempotency: "abc" }),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(409);
		expect(refundPayment).not.toHaveBeenCalled();
	});

	it("rejects refund amount > paid amount", async () => {
		paymentsSelectLimit.mockResolvedValueOnce([
			{
				id: VALID_UUID,
				razorpayPaymentId: "pay_xyz",
				amountPaise: 500,
				refundedAt: null,
				razorpayRefundId: null,
			},
		]);
		const { POST } = await import("@/app/api/admin/payments/[id]/refund/route");
		const res = await POST(
			refundReq({ idempotency: "abc", body: { amount_paise: 1000 } }),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
		expect(refundPayment).not.toHaveBeenCalled();
	});

	it("rejects unknown body keys (D14 .strict() schema)", async () => {
		paymentsSelectLimit.mockResolvedValueOnce([
			{
				id: VALID_UUID,
				razorpayPaymentId: "pay_xyz",
				amountPaise: 500,
				refundedAt: null,
				razorpayRefundId: null,
			},
		]);
		const { POST } = await import("@/app/api/admin/payments/[id]/refund/route");
		const res = await POST(
			refundReq({ idempotency: "abc", body: { amount_paise: 100, extraneous: "x" } }),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
		expect(refundPayment).not.toHaveBeenCalled();
	});

	it("401 when TOTP required and the code is missing/invalid (no Razorpay call)", async () => {
		paymentsSelectLimit.mockResolvedValueOnce([
			{
				id: VALID_UUID,
				razorpayPaymentId: "pay_xyz",
				amountPaise: 1000,
				refundedAt: null,
				razorpayRefundId: null,
			},
		]);
		isAdminTotpRequired.mockResolvedValueOnce(true);
		consumeAdminTotp.mockResolvedValueOnce(false);
		const { POST } = await import("@/app/api/admin/payments/[id]/refund/route");
		const res = await POST(
			refundReq({ idempotency: "abc", body: { totp: "000000" } }),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
		expect(refundPayment).not.toHaveBeenCalled();
		// The wrong code must NOT have reserved an idempotency row.
		expect(idempInsert).not.toHaveBeenCalled();
	});
});
