import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const adminGlobalSearch = vi.fn(async () => [
	{ type: "user", id: "u-1", label: "user@example.com" },
]);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/search", () => ({ adminGlobalSearch }));

describe("D32 Sprint B · GET /api/admin/search", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		adminGlobalSearch.mockClear();
		adminGlobalSearch.mockResolvedValue([
			{ type: "user", id: "u-1", label: "user@example.com" },
		]);
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/search/route");
		const res = await GET(adminRequest("/api/admin/search?q=abc"));
		expect(res.status).toBe(401);
	});

	it("rejects q shorter than 2 chars", async () => {
		const { GET } = await import("@/app/api/admin/search/route");
		const res = await GET(adminRequest("/api/admin/search?q=a"));
		expect(res.status).toBe(400);
	});

	it("rejects q longer than 120 chars", async () => {
		const { GET } = await import("@/app/api/admin/search/route");
		const res = await GET(adminRequest(`/api/admin/search?q=${"a".repeat(121)}`));
		expect(res.status).toBe(400);
	});

	it("happy path: returns hits + duration_ms meta", async () => {
		const { GET } = await import("@/app/api/admin/search/route");
		const res = await GET(adminRequest("/api/admin/search?q=user@"));
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			data: { type: string; id: string }[];
			meta: { duration_ms: number };
		};
		expect(body.data).toHaveLength(1);
		expect(typeof body.meta.duration_ms).toBe("number");
		expect(adminGlobalSearch).toHaveBeenCalledWith("user@");
	});
});
