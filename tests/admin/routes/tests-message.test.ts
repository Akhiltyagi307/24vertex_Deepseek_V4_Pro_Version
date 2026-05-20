import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const insertResolve = vi.fn(async () => ({ error: null as { message: string } | null }));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TEST_ADMIN_MESSAGE: "test_admin_message" },
}));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => ({
		from: () => ({ insert: insertResolve }),
	}),
}));

const TEST_ID = "22223333-4444-4555-8666-777788889999";

describe("D32 Sprint B · POST /api/admin/tests/[id]/message", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		insertResolve.mockClear();
		insertResolve.mockResolvedValue({ error: null });
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/tests/[id]/message/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/message`, { body: { body: "hello" } }),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects empty body", async () => {
		const { POST } = await import("@/app/api/admin/tests/[id]/message/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/message`, { body: { body: "" } }),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects body > 2000 chars", async () => {
		const { POST } = await import("@/app/api/admin/tests/[id]/message/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/message`, {
				body: { body: "x".repeat(2001) },
			}),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/tests/[id]/message/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/message`, {
				body: { body: "ok", extraneous: "x" },
			}),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("500 when DB insert errors", async () => {
		insertResolve.mockResolvedValueOnce({ error: { message: "boom" } });
		const { POST } = await import("@/app/api/admin/tests/[id]/message/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/message`, { body: { body: "hi" } }),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(500);
	});

	it("inserts message + audits with preview", async () => {
		const { POST } = await import("@/app/api/admin/tests/[id]/message/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/message`, {
				body: { body: "Please continue. " + "x".repeat(200) },
			}),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { preview: string };
		};
		expect(audit.action).toBe("test_admin_message");
		expect(audit.payload.preview.length).toBeLessThanOrEqual(120);
	});
});
