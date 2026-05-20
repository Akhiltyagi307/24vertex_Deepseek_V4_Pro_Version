import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const maybeSingle = vi.fn();
const adminRefundTestCredit = vi.fn(async () => ({
	ok: true,
	code: "refunded",
	deduped: false,
	message: "",
}));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TEST_REFUND_CREDIT: "test_refund_credit" },
}));
vi.mock("@/lib/admin/billing/test-refund", () => ({ adminRefundTestCredit }));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => ({
		from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
	}),
}));

const TEST_ID = "11112222-3333-4444-8555-666677778888";

describe("D32 Sprint B · POST /api/admin/tests/[id]/refund-credit", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		maybeSingle.mockReset();
		adminRefundTestCredit.mockClear();
		adminRefundTestCredit.mockResolvedValue({
			ok: true,
			code: "refunded",
			deduped: false,
			message: "",
		});
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/tests/[id]/refund-credit/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/refund-credit`, { body: { reason: "x" } }),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects empty reason", async () => {
		const { POST } = await import("@/app/api/admin/tests/[id]/refund-credit/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/refund-credit`, { body: { reason: "" } }),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/tests/[id]/refund-credit/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/refund-credit`, {
				body: { reason: "ok", extraneous: "x" },
			}),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when test not found", async () => {
		maybeSingle.mockResolvedValueOnce({ data: null, error: null });
		const { POST } = await import("@/app/api/admin/tests/[id]/refund-credit/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/refund-credit`, { body: { reason: "test" } }),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(404);
	});

	it("400 when nothing to refund (code: nothing_to_refund)", async () => {
		maybeSingle.mockResolvedValueOnce({ data: { student_id: "s-1" }, error: null });
		adminRefundTestCredit.mockResolvedValueOnce({
			ok: false,
			code: "nothing_to_refund",
			deduped: false,
			message: "nothing",
		});
		const { POST } = await import("@/app/api/admin/tests/[id]/refund-credit/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/refund-credit`, { body: { reason: "test" } }),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("happy path: refund + strict audit with idempotency key", async () => {
		maybeSingle.mockResolvedValueOnce({ data: { student_id: "s-1" }, error: null });
		const { POST } = await import("@/app/api/admin/tests/[id]/refund-credit/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/refund-credit`, {
				body: { reason: "admin comp", amount: 1 },
			}),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(200);
		expect(adminRefundTestCredit).toHaveBeenCalledTimes(1);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { reason: string; idempotency_key: string };
		};
		expect(audit.action).toBe("test_refund_credit");
		expect(audit.payload.reason).toBe("admin comp");
		expect(audit.payload.idempotency_key).toBeTruthy();
	});
});
