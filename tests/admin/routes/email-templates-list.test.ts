import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);

const slugOrderBy = vi.fn();
const orderByLimit = vi.fn();
const maxVersion = vi.fn(async () => [{ maxv: 0 }]);
const insertReturning = vi.fn();
const compileMjmlToHtml = vi.fn(async () => ({ html: "<p>x</p>", errors: [] as unknown[] }));
let nextSelect: "slug" | "default" | "max" = "default";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { EMAIL_TEMPLATE_VERSION_CREATE: "email_template_version_create" },
}));
vi.mock("@/lib/email/mjml-compile", () => ({ compileMjmlToHtml }));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn((sel?: unknown) => {
			if (sel && typeof sel === "object" && "maxv" in (sel as object)) {
				nextSelect = "max";
			}
			if (nextSelect === "max") {
				nextSelect = "default";
				return { from: () => ({ where: maxVersion }) };
			}
			if (nextSelect === "slug") {
				nextSelect = "default";
				return { from: () => ({ where: () => ({ orderBy: slugOrderBy }) }) };
			}
			return { from: () => ({ orderBy: () => ({ limit: orderByLimit }) }) };
		}),
		insert: () => ({ values: () => ({ returning: insertReturning }) }),
	},
}));

describe("D32 Sprint C · /api/admin/email-templates (GET + POST)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		slugOrderBy.mockReset();
		orderByLimit.mockReset();
		maxVersion.mockClear();
		maxVersion.mockResolvedValue([{ maxv: 0 }]);
		insertReturning.mockReset();
		compileMjmlToHtml.mockClear();
		compileMjmlToHtml.mockResolvedValue({ html: "<p>x</p>", errors: [] });
		nextSelect = "default";
	});

	it("GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/email-templates/route");
		const res = await GET(adminRequest("/api/admin/email-templates"));
		expect(res.status).toBe(401);
	});

	it("GET: returns list (no slug filter)", async () => {
		orderByLimit.mockResolvedValueOnce([{ id: "t1", slug: "welcome" }]);
		const { GET } = await import("@/app/api/admin/email-templates/route");
		const res = await GET(adminRequest("/api/admin/email-templates"));
		expect(res.status).toBe(200);
	});

	it("GET: filters by slug", async () => {
		nextSelect = "slug";
		slugOrderBy.mockResolvedValueOnce([{ id: "t1", slug: "welcome", version: 3 }]);
		const { GET } = await import("@/app/api/admin/email-templates/route");
		const res = await GET(adminRequest("/api/admin/email-templates?slug=welcome"));
		expect(res.status).toBe(200);
	});

	it("POST: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/email-templates/route");
		const res = await POST(
			adminRequest("/api/admin/email-templates", {
				body: { slug: "x", subject_tmpl: "y", body_mjml: "z" },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("POST: rejects missing fields", async () => {
		const { POST } = await import("@/app/api/admin/email-templates/route");
		const res = await POST(
			adminRequest("/api/admin/email-templates", { body: { slug: "x" } }),
		);
		expect(res.status).toBe(400);
	});

	it("POST: rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/email-templates/route");
		const res = await POST(
			adminRequest("/api/admin/email-templates", {
				body: { slug: "x", subject_tmpl: "y", body_mjml: "z", extraneous: "x" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("POST: 400 when MJML compile fails", async () => {
		compileMjmlToHtml.mockResolvedValueOnce({ html: "", errors: [{ message: "bad" }] });
		const { POST } = await import("@/app/api/admin/email-templates/route");
		const res = await POST(
			adminRequest("/api/admin/email-templates", {
				body: { slug: "x", subject_tmpl: "y", body_mjml: "bad mjml" },
			}),
		);
		expect(res.status).toBe(400);
		expect(insertReturning).not.toHaveBeenCalled();
	});

	it("POST: happy path inserts version + audits", async () => {
		nextSelect = "max";
		maxVersion.mockResolvedValueOnce([{ maxv: 4 }]);
		insertReturning.mockResolvedValueOnce([{ id: "t-new", slug: "welcome", version: 5 }]);
		const { POST } = await import("@/app/api/admin/email-templates/route");
		const res = await POST(
			adminRequest("/api/admin/email-templates", {
				body: { slug: "welcome", subject_tmpl: "Hi {{name}}", body_mjml: "<mj-body/>" },
			}),
		);
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { slug: string; version: number };
		};
		expect(audit.action).toBe("email_template_version_create");
		expect(audit.payload.version).toBe(5);
	});
});
