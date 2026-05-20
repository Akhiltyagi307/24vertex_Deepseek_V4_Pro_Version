import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const selectLimit = vi.fn();
const sendHtmlEmailLogged = vi.fn(async () => ({ error: null as string | null }));
const broadcastBodyToEmailHtml = vi.fn(() => "<p>body</p>");

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { BROADCAST_TEST_SEND: "broadcast_test_send" },
}));
vi.mock("@/lib/admin/broadcast-markdown", () => ({ broadcastBodyToEmailHtml }));
vi.mock("@/lib/email/send-html-email", () => ({ sendHtmlEmailLogged }));
vi.mock("@/db", () => ({
	db: { select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }) },
}));

describe("D32 Sprint C · POST /api/admin/broadcasts/[id]/test", () => {
	beforeEach(() => {
		process.env.ADMIN_EMAIL = "admin@x";
	});

	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		selectLimit.mockReset();
		writeAdminActionStrict.mockClear();
		sendHtmlEmailLogged.mockClear();
		sendHtmlEmailLogged.mockResolvedValue({ error: null });
		delete process.env.ADMIN_EMAIL;
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/broadcasts/[id]/test/route");
		const res = await POST(adminRequest("/api/admin/broadcasts/b1/test", { method: "POST" }), {
			params: Promise.resolve({ id: "b1" }),
		});
		expect(res.status).toBe(401);
	});

	it("404 when broadcast not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/broadcasts/[id]/test/route");
		const res = await POST(adminRequest("/api/admin/broadcasts/b1/test", { method: "POST" }), {
			params: Promise.resolve({ id: "b1" }),
		});
		expect(res.status).toBe(404);
	});

	it("500 when ADMIN_EMAIL is not configured", async () => {
		delete process.env.ADMIN_EMAIL;
		selectLimit.mockResolvedValueOnce([{ id: "b1", subject: "S", bodyMd: "B" }]);
		const { POST } = await import("@/app/api/admin/broadcasts/[id]/test/route");
		const res = await POST(adminRequest("/api/admin/broadcasts/b1/test", { method: "POST" }), {
			params: Promise.resolve({ id: "b1" }),
		});
		expect(res.status).toBe(500);
	});

	it("happy path: sends email + strict audit", async () => {
		selectLimit.mockResolvedValueOnce([{ id: "b1", subject: "Sub", bodyMd: "Body" }]);
		const { POST } = await import("@/app/api/admin/broadcasts/[id]/test/route");
		const res = await POST(adminRequest("/api/admin/broadcasts/b1/test", { method: "POST" }), {
			params: Promise.resolve({ id: "b1" }),
		});
		expect(res.status).toBe(200);
		expect(sendHtmlEmailLogged).toHaveBeenCalledWith(
			expect.objectContaining({ to: "admin@x", subject: "[Test] Sub", broadcastId: "b1" }),
		);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("broadcast_test_send");
		expect(audit.targetId).toBe("b1");
	});

	it("500 when email send fails", async () => {
		selectLimit.mockResolvedValueOnce([{ id: "b1", subject: "S", bodyMd: "B" }]);
		sendHtmlEmailLogged.mockResolvedValueOnce({ error: "resend down" });
		const { POST } = await import("@/app/api/admin/broadcasts/[id]/test/route");
		const res = await POST(adminRequest("/api/admin/broadcasts/b1/test", { method: "POST" }), {
			params: Promise.resolve({ id: "b1" }),
		});
		expect(res.status).toBe(500);
		expect(writeAdminActionStrict).not.toHaveBeenCalled();
	});
});
