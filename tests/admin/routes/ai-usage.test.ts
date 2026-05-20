import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);

const selectGroupBy = vi.fn();
const selectGroupByLimit = vi.fn();
const selectListLimit = vi.fn();
let nextSelect: "by-feature" | "top-users" | "recent" = "by-feature";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => {
			if (nextSelect === "by-feature") {
				nextSelect = "top-users";
				return { from: () => ({ where: () => ({ groupBy: selectGroupBy }) }) };
			}
			if (nextSelect === "top-users") {
				nextSelect = "recent";
				return {
					from: () => ({
						where: () => ({ groupBy: () => ({ orderBy: () => ({ limit: selectGroupByLimit }) }) }),
					}),
				};
			}
			return {
				from: () => ({ where: () => ({ orderBy: () => ({ limit: selectListLimit }) }) }),
			};
		}),
	},
}));

describe("D32 Sprint C · GET /api/admin/ai/usage", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		selectGroupBy.mockReset();
		selectGroupBy.mockResolvedValue([{ feature: "doubt", n: 10, inSum: 100, outSum: 50 }]);
		selectGroupByLimit.mockReset();
		selectGroupByLimit.mockResolvedValue([{ userId: "u-1", tokens: 100 }]);
		selectListLimit.mockReset();
		selectListLimit.mockResolvedValue([]);
		nextSelect = "by-feature";
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/ai/usage/route");
		const res = await GET(adminRequest("/api/admin/ai/usage"));
		expect(res.status).toBe(401);
	});

	it("returns by_feature + top_users + recent", async () => {
		const { GET } = await import("@/app/api/admin/ai/usage/route");
		const res = await GET(adminRequest("/api/admin/ai/usage"));
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			by_feature: { feature: string }[];
			top_users: { userId: string }[];
			recent: unknown[];
		};
		expect(body.by_feature[0]?.feature).toBe("doubt");
		expect(body.top_users[0]?.userId).toBe("u-1");
	});

	it("accepts ?from=, ?to=, ?feature= filters (ignores invalid dates)", async () => {
		const { GET } = await import("@/app/api/admin/ai/usage/route");
		const res = await GET(
			adminRequest("/api/admin/ai/usage?from=2026-01-01&to=2026-02-01&feature=doubt"),
		);
		expect(res.status).toBe(200);
	});

	it("500 envelope when DB throws", async () => {
		selectGroupBy.mockRejectedValueOnce(new Error("db down"));
		const { GET } = await import("@/app/api/admin/ai/usage/route");
		const res = await GET(adminRequest("/api/admin/ai/usage"));
		expect(res.status).toBe(500);
	});
});
