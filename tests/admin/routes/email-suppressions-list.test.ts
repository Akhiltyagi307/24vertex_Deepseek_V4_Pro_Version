import { NextResponse } from "next/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const getResendApiKey = vi.fn(() => "rs_test_key");

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/env", () => ({ getResendApiKey }));

describe("D32 Sprint C · GET /api/admin/email-log/suppressions", () => {
	beforeAll(() => {
		globalThis.fetch = vi.fn() as typeof fetch;
	});

	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/email-log/suppressions/route");
		const res = await GET();
		expect(res.status).toBe(401);
		// fetch shouldn't be called when the gate rejects
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("502 when Resend API errors", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
			new Response("server fail", { status: 500 }),
		);
		const { GET } = await import("@/app/api/admin/email-log/suppressions/route");
		const res = await GET();
		expect(res.status).toBe(502);
	});

	it("happy path returns resend body", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
			new Response(JSON.stringify({ data: [{ email: "x@y.com" }] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		const { GET } = await import("@/app/api/admin/email-log/suppressions/route");
		const res = await GET();
		expect(res.status).toBe(200);
		expect(globalThis.fetch).toHaveBeenCalledWith(
			"https://api.resend.com/suppressions/bounces",
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: "Bearer rs_test_key" }),
			}),
		);
	});

});
