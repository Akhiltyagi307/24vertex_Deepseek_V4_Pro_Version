import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const selectLimit = vi.fn();
const txUpdateWhere = vi.fn(async () => undefined);
const transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
	cb({ update: () => ({ set: () => ({ where: txUpdateWhere }) }) }),
);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { EMAIL_TEMPLATE_ACTIVATE: "email_template_activate" },
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		transaction,
	},
}));

describe("D32 Sprint B · POST /api/admin/email-templates/[id]/activate", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		selectLimit.mockReset();
		transaction.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/email-templates/[id]/activate/route");
		const res = await POST(
			new Request("http://localhost/api/admin/email-templates/t1/activate"),
			{ params: Promise.resolve({ id: "t1" }) },
		);
		expect(res.status).toBe(401);
	});

	it("404 when template not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/email-templates/[id]/activate/route");
		const res = await POST(
			new Request("http://localhost/api/admin/email-templates/t1/activate"),
			{ params: Promise.resolve({ id: "t1" }) },
		);
		expect(res.status).toBe(404);
	});

	it("happy path: audits + transactional flip + returns updated row", async () => {
		selectLimit
			.mockResolvedValueOnce([{ id: "t1", slug: "welcome", version: 3 }])
			.mockResolvedValueOnce([{ id: "t1", slug: "welcome", version: 3, isActive: true }]);
		const { POST } = await import("@/app/api/admin/email-templates/[id]/activate/route");
		const res = await POST(
			new Request("http://localhost/api/admin/email-templates/t1/activate"),
			{ params: Promise.resolve({ id: "t1" }) },
		);
		expect(res.status).toBe(200);
		expect(transaction).toHaveBeenCalledTimes(1);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
			payload: { slug: string; version: number };
		};
		expect(audit.action).toBe("email_template_activate");
		expect(audit.payload.slug).toBe("welcome");
		expect(audit.payload.version).toBe(3);
	});
});
