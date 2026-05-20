import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const listAdminOrganizations = vi.fn(async () => [] as unknown[]);
const insertReturning = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { ORGANIZATION_CREATE: "organization_create" },
}));
vi.mock("@/lib/organizations/linking-code", () => ({
	generateOrganizationLinkingCode: () => "ABC123",
}));
vi.mock("@/lib/organizations/queries", () => ({
	listAdminOrganizations,
	organizationInputToDbValues: (input: { name: string; type: string }) => input,
}));
vi.mock("@/lib/organizations/schemas", () => ({
	adminOrganizationInputSchema: z
		.object({ name: z.string().min(1), type: z.enum(["school", "coaching", "other"]) })
		.strict(),
	serializeOrganizationAdmin: (row: unknown) => row,
}));
vi.mock("@/db", () => ({
	db: { insert: () => ({ values: () => ({ returning: insertReturning }) }) },
}));

describe("D32 Sprint C · /api/admin/organizations (GET + POST)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		listAdminOrganizations.mockClear();
		listAdminOrganizations.mockResolvedValue([]);
		insertReturning.mockReset();
	});

	it("GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/organizations/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("GET: returns list", async () => {
		listAdminOrganizations.mockResolvedValueOnce([{ id: "org-1", name: "Acme" }]);
		const { GET } = await import("@/app/api/admin/organizations/route");
		const res = await GET();
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string }[] };
		expect(body.data).toHaveLength(1);
	});

	it("POST: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/organizations/route");
		const res = await POST(
			adminRequest("/api/admin/organizations", { body: { name: "Acme", type: "school" } }),
		);
		expect(res.status).toBe(401);
	});

	it("POST: rejects invalid type", async () => {
		const { POST } = await import("@/app/api/admin/organizations/route");
		const res = await POST(
			adminRequest("/api/admin/organizations", { body: { name: "Acme", type: "fake" } }),
		);
		expect(res.status).toBe(400);
	});

	it("POST: happy path inserts + audits", async () => {
		insertReturning.mockResolvedValueOnce([{ id: "org-new", name: "Acme", type: "school" }]);
		const { POST } = await import("@/app/api/admin/organizations/route");
		const res = await POST(
			adminRequest("/api/admin/organizations", { body: { name: "Acme", type: "school" } }),
		);
		expect(res.status).toBe(201);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { name: string; type: string };
		};
		expect(audit.action).toBe("organization_create");
		expect(audit.payload.name).toBe("Acme");
	});
});
