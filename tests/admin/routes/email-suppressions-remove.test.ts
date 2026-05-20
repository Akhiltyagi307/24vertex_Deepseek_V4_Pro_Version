import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const getResendApiKey = vi.fn(() => "re_test_key");

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { EMAIL_SUPPRESSION_REMOVE: "email_suppression_remove" },
}));
vi.mock("@/lib/env", () => ({ getResendApiKey }));

const originalFetch = globalThis.fetch;

describe("D32 Sprint B · POST /api/admin/email-log/suppressions/remove", () => {
	beforeEach(() => {
		globalThis.fetch = vi.fn(
			async () => new Response("", { status: 200 }),
		) as unknown as typeof fetch;
	});
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		globalThis.fetch = originalFetch;
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/email-log/suppressions/remove/route");
		const res = await POST(
			adminRequest("/api/admin/email-log/suppressions/remove", {
				body: { email: "x@y.com", reason: "test" },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("rejects invalid email", async () => {
		const { POST } = await import("@/app/api/admin/email-log/suppressions/remove/route");
		const res = await POST(
			adminRequest("/api/admin/email-log/suppressions/remove", {
				body: { email: "not-an-email", reason: "test" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/email-log/suppressions/remove/route");
		const res = await POST(
			adminRequest("/api/admin/email-log/suppressions/remove", {
				body: { email: "x@y.com", reason: "test", extraneous: "x" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("502 when Resend API fails", async () => {
		globalThis.fetch = vi.fn(
			async () => new Response("not ok", { status: 500 }),
		) as unknown as typeof fetch;
		const { POST } = await import("@/app/api/admin/email-log/suppressions/remove/route");
		const res = await POST(
			adminRequest("/api/admin/email-log/suppressions/remove", {
				body: { email: "x@y.com", reason: "test" },
			}),
		);
		expect(res.status).toBe(502);
		expect(writeAdminActionStrict).not.toHaveBeenCalled();
	});

	it("happy path: calls Resend + strict audit", async () => {
		const fetchSpy = vi.fn(
			async () => new Response("", { status: 200 }),
		) as unknown as typeof fetch;
		globalThis.fetch = fetchSpy;
		const { POST } = await import("@/app/api/admin/email-log/suppressions/remove/route");
		const res = await POST(
			adminRequest("/api/admin/email-log/suppressions/remove", {
				body: { email: "x@y.com", reason: "operator review" },
			}),
		);
		expect(res.status).toBe(200);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { email: string };
		};
		expect(audit.action).toBe("email_suppression_remove");
		expect(audit.payload.email).toBe("x@y.com");
	});
});
