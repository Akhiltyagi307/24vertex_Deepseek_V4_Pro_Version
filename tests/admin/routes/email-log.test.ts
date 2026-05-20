import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const listOffset = vi.fn();
const countWhere = vi.fn();
let nextSelect: "list" | "count" = "list";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/env", () => ({ getResendApiKey: () => "re_test" }));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn((sel?: unknown) => {
			if (sel && typeof sel === "object" && "c" in (sel as object)) {
				nextSelect = "count";
			}
			if (nextSelect === "count") {
				nextSelect = "list";
				return { from: () => ({ where: countWhere }) };
			}
			return {
				from: () => ({
					where: () => ({ orderBy: () => ({ limit: () => ({ offset: listOffset }) }) }),
				}),
			};
		}),
	},
}));

describe("D32 Sprint C · email-log GET + suppressions GET", () => {
	const originalFetch = globalThis.fetch;
	beforeEach(() => {
		globalThis.fetch = vi.fn(
			async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
		) as unknown as typeof fetch;
	});
	afterEach(() => {
		globalThis.fetch = originalFetch;
		gateRef.value = ADMIN_GATE_ALLOW;
		listOffset.mockReset();
		listOffset.mockResolvedValue([]);
		countWhere.mockReset();
		countWhere.mockResolvedValue([{ c: 0 }]);
		nextSelect = "list";
	});

	it("email-log GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/email-log/route");
		const res = await GET(adminRequest("/api/admin/email-log"));
		expect(res.status).toBe(401);
	});

	it("email-log GET: returns paginated list with filters", async () => {
		listOffset.mockResolvedValueOnce([{ id: "log-1", status: "sent" }]);
		countWhere.mockResolvedValueOnce([{ c: 1 }]);
		const { GET } = await import("@/app/api/admin/email-log/route");
		const res = await GET(
			adminRequest("/api/admin/email-log?status=sent&template=welcome&q=x&has_error=1"),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown[]; total: number };
		expect(body.total).toBe(1);
	});

	it("suppressions GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/email-log/suppressions/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("suppressions GET: 502 when Resend errors", async () => {
		globalThis.fetch = vi.fn(
			async () => new Response("nope", { status: 500 }),
		) as unknown as typeof fetch;
		const { GET } = await import("@/app/api/admin/email-log/suppressions/route");
		const res = await GET();
		expect(res.status).toBe(502);
	});

	it("suppressions GET: happy path returns Resend payload", async () => {
		const { GET } = await import("@/app/api/admin/email-log/suppressions/route");
		const res = await GET();
		expect(res.status).toBe(200);
	});
});
