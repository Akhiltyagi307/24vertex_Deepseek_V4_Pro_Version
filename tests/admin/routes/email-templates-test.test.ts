import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const selectLimit = vi.fn();
const compileMjmlToHtml = vi.fn(async () => ({ html: "<p>Hello {{student_name}}</p>" }));
const sendHtmlEmailLogged = vi.fn(async () => ({ error: null as string | null }));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { EMAIL_TEMPLATE_TEST_SEND: "email_template_test_send" },
}));
vi.mock("@/lib/email/mjml-compile", () => ({ compileMjmlToHtml }));
vi.mock("@/lib/email/send-html-email", () => ({ sendHtmlEmailLogged }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
	},
}));

describe("D32 Sprint B · POST /api/admin/email-templates/[id]/test", () => {
	beforeEach(() => {
		process.env.ADMIN_EMAIL = "admin@test.local";
	});
	afterEach(() => {
		delete process.env.ADMIN_EMAIL;
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		selectLimit.mockReset();
		sendHtmlEmailLogged.mockClear();
		sendHtmlEmailLogged.mockResolvedValue({ error: null });
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/email-templates/[id]/test/route");
		const res = await POST(
			adminRequest("/api/admin/email-templates/t1/test", { body: {} }),
			{ params: Promise.resolve({ id: "t1" }) },
		);
		expect(res.status).toBe(401);
	});

	it("404 when template not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/email-templates/[id]/test/route");
		const res = await POST(
			adminRequest("/api/admin/email-templates/missing/test", { body: {} }),
			{ params: Promise.resolve({ id: "missing" }) },
		);
		expect(res.status).toBe(404);
	});

	it("rejects extra keys (D14 strict)", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: "t1", slug: "welcome", subjectTmpl: "Hi", bodyMjml: "<mj-body/>" },
		]);
		const { POST } = await import("@/app/api/admin/email-templates/[id]/test/route");
		const res = await POST(
			adminRequest("/api/admin/email-templates/t1/test", {
				body: { variables: {}, extraneous: "x" },
			}),
			{ params: Promise.resolve({ id: "t1" }) },
		);
		expect(res.status).toBe(400);
	});

	it("500 when ADMIN_EMAIL is not configured", async () => {
		delete process.env.ADMIN_EMAIL;
		selectLimit.mockResolvedValueOnce([
			{ id: "t1", slug: "welcome", subjectTmpl: "Hi {{name}}", bodyMjml: "<mj-body/>" },
		]);
		const { POST } = await import("@/app/api/admin/email-templates/[id]/test/route");
		const res = await POST(
			adminRequest("/api/admin/email-templates/t1/test", { body: {} }),
			{ params: Promise.resolve({ id: "t1" }) },
		);
		expect(res.status).toBe(500);
	});

	it("500 when sendHtmlEmailLogged errors", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: "t1", slug: "welcome", subjectTmpl: "Hi", bodyMjml: "<mj-body/>" },
		]);
		sendHtmlEmailLogged.mockResolvedValueOnce({ error: "Resend down" });
		const { POST } = await import("@/app/api/admin/email-templates/[id]/test/route");
		const res = await POST(
			adminRequest("/api/admin/email-templates/t1/test", { body: {} }),
			{ params: Promise.resolve({ id: "t1" }) },
		);
		expect(res.status).toBe(500);
		expect(writeAdminActionStrict).not.toHaveBeenCalled();
	});

	it("happy path: sends template + strict audit", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: "t1", slug: "welcome", subjectTmpl: "Hi {{student_name}}", bodyMjml: "<mj-body/>" },
		]);
		const { POST } = await import("@/app/api/admin/email-templates/[id]/test/route");
		const res = await POST(
			adminRequest("/api/admin/email-templates/t1/test", {
				body: { variables: { student_name: "Alex" } },
			}),
			{ params: Promise.resolve({ id: "t1" }) },
		);
		expect(res.status).toBe(200);
		expect(sendHtmlEmailLogged).toHaveBeenCalledTimes(1);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("email_template_test_send");
		expect(audit.targetId).toBe("t1");
	});
});
