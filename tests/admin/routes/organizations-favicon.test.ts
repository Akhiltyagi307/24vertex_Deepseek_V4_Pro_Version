import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const selectLimit = vi.fn();
const updateReturning = vi.fn(async () => [
	{ id: "11111111-1111-4111-8111-111111111111", name: "Acme", faviconUrl: "https://x/y.png" },
]);
const serializeOrganizationAdmin = vi.fn((row: unknown) => row);

const storageList = vi.fn(async () => ({ data: [] as Array<{ name: string }> }));
const storageRemove = vi.fn(async () => ({ data: null }));
const storageUpload = vi.fn(async () => ({ data: null, error: null as { message?: string } | null }));
const storageGetPublicUrl = vi.fn(() => ({ data: { publicUrl: "https://x/y.png" } }));

const createServiceRoleClient = vi.fn(() => ({
	storage: {
		from: () => ({
			list: storageList,
			remove: storageRemove,
			upload: storageUpload,
			getPublicUrl: storageGetPublicUrl,
		}),
	},
}));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { ORGANIZATION_UPDATE: "organization_update" },
}));
vi.mock("@/lib/organizations/schemas", () => ({ serializeOrganizationAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		update: () => ({ set: () => ({ where: () => ({ returning: updateReturning }) }) }),
	},
}));

const ORG = "11111111-1111-4111-8111-111111111111";

function favRequest(form: FormData): NextRequest {
	return new NextRequest(new URL(`/api/admin/organizations/${ORG}/favicon`, "http://localhost:3001"), {
		method: "POST",
		body: form,
	});
}

describe("D32 Sprint C · POST /api/admin/organizations/[id]/favicon", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		selectLimit.mockReset();
		writeAdminAction.mockClear();
		updateReturning.mockClear();
		storageList.mockReset();
		storageList.mockResolvedValue({ data: [] });
		storageRemove.mockClear();
		storageUpload.mockReset();
		storageUpload.mockResolvedValue({ data: null, error: null });
		storageGetPublicUrl.mockClear();
		storageGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://x/y.png" } });
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/organizations/[id]/favicon/route");
		const fd = new FormData();
		const res = await POST(favRequest(fd), { params: Promise.resolve({ id: ORG }) });
		expect(res.status).toBe(401);
	});

	it("400 invalid id", async () => {
		const { POST } = await import("@/app/api/admin/organizations/[id]/favicon/route");
		const fd = new FormData();
		const res = await POST(favRequest(fd), { params: Promise.resolve({ id: "bad" }) });
		expect(res.status).toBe(400);
	});

	it("404 when org not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/organizations/[id]/favicon/route");
		const fd = new FormData();
		fd.append("file", new File([new Uint8Array([1, 2, 3])], "favicon.png", { type: "image/png" }));
		const res = await POST(favRequest(fd), { params: Promise.resolve({ id: ORG }) });
		expect(res.status).toBe(404);
	});

	it("400 missing file", async () => {
		selectLimit.mockResolvedValueOnce([{ id: ORG, name: "Acme" }]);
		const { POST } = await import("@/app/api/admin/organizations/[id]/favicon/route");
		const fd = new FormData();
		const res = await POST(favRequest(fd), { params: Promise.resolve({ id: ORG }) });
		expect(res.status).toBe(400);
	});

	it("400 unsupported mime", async () => {
		selectLimit.mockResolvedValueOnce([{ id: ORG, name: "Acme" }]);
		const { POST } = await import("@/app/api/admin/organizations/[id]/favicon/route");
		const fd = new FormData();
		fd.append("file", new File([new Uint8Array([1])], "x.gif", { type: "image/gif" }));
		const res = await POST(favRequest(fd), { params: Promise.resolve({ id: ORG }) });
		expect(res.status).toBe(400);
	});

	it("happy path: uploads + audits", async () => {
		selectLimit.mockResolvedValueOnce([{ id: ORG, name: "Acme" }]);
		const { POST } = await import("@/app/api/admin/organizations/[id]/favicon/route");
		const fd = new FormData();
		fd.append(
			"file",
			new File([new Uint8Array([1, 2, 3])], "favicon.png", { type: "image/png" }),
		);
		const res = await POST(favRequest(fd), { params: Promise.resolve({ id: ORG }) });
		expect(res.status).toBe(200);
		expect(storageUpload).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("organization_update");
	});

	it("502 when storage upload fails", async () => {
		selectLimit.mockResolvedValueOnce([{ id: ORG, name: "Acme" }]);
		storageUpload.mockResolvedValueOnce({ data: null, error: { message: "supabase down" } });
		const { POST } = await import("@/app/api/admin/organizations/[id]/favicon/route");
		const fd = new FormData();
		fd.append("file", new File([new Uint8Array([1])], "x.png", { type: "image/png" }));
		const res = await POST(favRequest(fd), { params: Promise.resolve({ id: ORG }) });
		expect(res.status).toBe(502);
	});
});
