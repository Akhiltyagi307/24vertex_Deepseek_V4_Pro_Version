import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const selectLimit = vi.fn();
const compileMjmlToHtml = vi.fn(async () => ({ html: "<p>Hello {{name}}</p>", errors: [] }));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/email/mjml-compile", () => ({ compileMjmlToHtml }));
vi.mock("@/db", () => ({
	db: { select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }) },
}));

describe("D32 Sprint B · POST /api/admin/email-templates/[id]/preview", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		selectLimit.mockReset();
		compileMjmlToHtml.mockClear();
		compileMjmlToHtml.mockResolvedValue({ html: "<p>Hello {{name}}</p>", errors: [] });
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/email-templates/[id]/preview/route");
		const res = await POST(
			adminRequest("/api/admin/email-templates/t1/preview", { body: {} }),
			{ params: Promise.resolve({ id: "t1" }) },
		);
		expect(res.status).toBe(401);
	});

	it("404 when template not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/email-templates/[id]/preview/route");
		const res = await POST(
			adminRequest("/api/admin/email-templates/missing/preview", { body: {} }),
			{ params: Promise.resolve({ id: "missing" }) },
		);
		expect(res.status).toBe(404);
	});

	it("rejects extra keys (D14 strict)", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: "t1", subjectTmpl: "S", bodyMjml: "<mj-body/>" },
		]);
		const { POST } = await import("@/app/api/admin/email-templates/[id]/preview/route");
		const res = await POST(
			adminRequest("/api/admin/email-templates/t1/preview", {
				body: { variables: {}, extraneous: "x" },
			}),
			{ params: Promise.resolve({ id: "t1" }) },
		);
		expect(res.status).toBe(400);
	});

	it("happy path: returns interpolated subject + html + mjml_errors", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: "t1", subjectTmpl: "Hi {{name}}", bodyMjml: "<mj-body/>" },
		]);
		const { POST } = await import("@/app/api/admin/email-templates/[id]/preview/route");
		const res = await POST(
			adminRequest("/api/admin/email-templates/t1/preview", {
				body: { variables: { name: "Alex" } },
			}),
			{ params: Promise.resolve({ id: "t1" }) },
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { subject: string; html: string };
		expect(body.subject).toBe("Hi Alex");
		expect(body.html).toContain("Alex");
	});
});
