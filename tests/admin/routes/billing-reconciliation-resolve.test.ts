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
	ADMIN_ACTIONS: { BILLING_RECONCILIATION_DRIFT_RESOLVE: "billing_reconciliation_drift_resolve" },
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		update: () => ({ set: () => ({ where: updateWhere }) }),
	},
}));

const DRIFT_UUID = "70707070-7070-4070-8070-707070707070";

describe("POST /api/admin/billing/reconciliation/[id]/resolve", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		selectLimit.mockReset();
		updateWhere.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/billing/reconciliation/[id]/resolve/route");
		const res = await POST(
			adminRequest(`/api/admin/billing/reconciliation/${DRIFT_UUID}/resolve`, {
				body: { resolution_note: "manual fix" },
			}),
			{ params: Promise.resolve({ id: DRIFT_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("resolves open drift row", async () => {
		selectLimit.mockResolvedValue([{ id: DRIFT_UUID, resolvedAt: null }]);
		const { POST } = await import("@/app/api/admin/billing/reconciliation/[id]/resolve/route");
		const res = await POST(
			adminRequest(`/api/admin/billing/reconciliation/${DRIFT_UUID}/resolve`, {
				body: { resolution_note: "accepted razorpay value" },
			}),
			{ params: Promise.resolve({ id: DRIFT_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(writeAdminActionStrict).toHaveBeenCalled();
		expect(updateWhere).toHaveBeenCalled();
	});
});
