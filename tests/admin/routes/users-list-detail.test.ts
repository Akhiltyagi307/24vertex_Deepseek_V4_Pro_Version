import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const adminListUsers = vi.fn<
	(input: {
		role: string;
		page: number;
		pageSize: number;
		grade: number | null;
		includeDeleted: boolean;
		q?: string | null;
	}) => Promise<{ rows: Array<Record<string, unknown>>; total: number }>
>(async () => ({ rows: [], total: 0 }));
const adminGetUserById = vi.fn<(id: string) => Promise<unknown>>();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/users-list", () => ({ adminListUsers, adminGetUserById }));

const USER_UUID = "abcdef12-3456-4789-89ab-cdef12345678";

describe("D32 Sprint C · users list (GET) + detail (GET)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		adminListUsers.mockClear();
		adminListUsers.mockResolvedValue({ rows: [], total: 0 });
		adminGetUserById.mockReset();
	});

	it("list GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/users/route");
		const res = await GET(adminRequest("/api/admin/users?role=student"));
		expect(res.status).toBe(401);
	});

	it("list GET: rejects missing/invalid role", async () => {
		const { GET } = await import("@/app/api/admin/users/route");
		const res = await GET(adminRequest("/api/admin/users?role=ghost"));
		expect(res.status).toBe(400);
	});

	it("list GET: forwards pagination + filters", async () => {
		adminListUsers.mockResolvedValueOnce({
			rows: [{ id: USER_UUID, role: "student" }],
			total: 1,
		});
		const { GET } = await import("@/app/api/admin/users/route");
		const res = await GET(
			adminRequest(
				"/api/admin/users?role=student&page=2&page_size=10&grade=10&q=foo&include_deleted=1",
			),
		);
		expect(res.status).toBe(200);
		const arg = adminListUsers.mock.calls[0]?.[0] as {
			role: string;
			page: number;
			pageSize: number;
			grade: number | null;
			includeDeleted: boolean;
		};
		expect(arg.role).toBe("student");
		expect(arg.page).toBe(2);
		expect(arg.pageSize).toBe(10);
		expect(arg.grade).toBe(10);
		expect(arg.includeDeleted).toBe(true);
	});

	it("detail GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/users/[id]/route");
		const res = await GET(new Request(`http://localhost/api/admin/users/${USER_UUID}`), {
			params: Promise.resolve({ id: USER_UUID }),
		});
		expect(res.status).toBe(401);
	});

	it("detail GET: 400 invalid UUID", async () => {
		const { GET } = await import("@/app/api/admin/users/[id]/route");
		const res = await GET(new Request("http://localhost/api/admin/users/bad"), {
			params: Promise.resolve({ id: "bad" }),
		});
		expect(res.status).toBe(400);
	});

	it("detail GET: 404 when not found", async () => {
		adminGetUserById.mockResolvedValueOnce(null);
		const { GET } = await import("@/app/api/admin/users/[id]/route");
		const res = await GET(new Request(`http://localhost/api/admin/users/${USER_UUID}`), {
			params: Promise.resolve({ id: USER_UUID }),
		});
		expect(res.status).toBe(404);
	});

	it("detail GET: happy path returns row", async () => {
		adminGetUserById.mockResolvedValueOnce({ id: USER_UUID, full_name: "U" });
		const { GET } = await import("@/app/api/admin/users/[id]/route");
		const res = await GET(new Request(`http://localhost/api/admin/users/${USER_UUID}`), {
			params: Promise.resolve({ id: USER_UUID }),
		});
		expect(res.status).toBe(200);
	});
});
