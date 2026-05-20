import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const countBroadcastAudience = vi.fn(async () => 42);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/broadcast-audience", () => ({ countBroadcastAudience }));

describe("D32 Sprint C · POST /api/admin/broadcasts/preview", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		countBroadcastAudience.mockClear();
		countBroadcastAudience.mockResolvedValue(42);
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/broadcasts/preview/route");
		const res = await POST(
			adminRequest("/api/admin/broadcasts/preview", { body: { audience: { kind: "all" } } }),
		);
		expect(res.status).toBe(401);
	});

	it("rejects invalid audience kind", async () => {
		const { POST } = await import("@/app/api/admin/broadcasts/preview/route");
		const res = await POST(
			adminRequest("/api/admin/broadcasts/preview", { body: { audience: { kind: "wat" } } }),
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra keys (D14 strict on wrapper + audience)", async () => {
		const { POST } = await import("@/app/api/admin/broadcasts/preview/route");
		const res = await POST(
			adminRequest("/api/admin/broadcasts/preview", {
				body: { audience: { kind: "all" }, extraneous: "x" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("happy path: returns count from countBroadcastAudience", async () => {
		const { POST } = await import("@/app/api/admin/broadcasts/preview/route");
		const res = await POST(
			adminRequest("/api/admin/broadcasts/preview", {
				body: { audience: { kind: "grade", grade: 10 } },
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { count: number };
		expect(body.count).toBe(42);
	});
});
