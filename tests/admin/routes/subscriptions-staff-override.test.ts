import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
class AdminAuditWriteError extends Error {}
const updateReturning = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction, writeAdminActionStrict, AdminAuditWriteError }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { SUBSCRIPTION_STAFF_OVERRIDE: "subscription_staff_override" },
}));
vi.mock("@/db", () => ({
	db: {
		update: () => ({
			set: () => ({ where: () => ({ returning: updateReturning }) }),
		}),
	},
}));

const VALID_UUID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("D32 Sprint B · POST /api/admin/subscriptions/[id]/staff-override", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		writeAdminActionStrict.mockClear();
		updateReturning.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/staff-override/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/staff-override`, {
				body: { staff_override: true },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects invalid UUID", async () => {
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/staff-override/route");
		const res = await POST(
			adminRequest("/api/admin/subscriptions/bad/staff-override", {
				body: { staff_override: true },
			}),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects non-boolean staff_override", async () => {
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/staff-override/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/staff-override`, {
				body: { staff_override: "yes" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/staff-override/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/staff-override`, {
				body: { staff_override: true, extraneous: "x" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when subscription not found", async () => {
		updateReturning.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/staff-override/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/staff-override`, {
				body: { staff_override: false },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("flips staff_override and audits", async () => {
		updateReturning.mockResolvedValueOnce([{ id: VALID_UUID }]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/staff-override/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/staff-override`, {
				body: { staff_override: true },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { staff_override: boolean };
		};
		expect(audit.action).toBe("subscription_staff_override");
		expect(audit.payload.staff_override).toBe(true);
	});
});
