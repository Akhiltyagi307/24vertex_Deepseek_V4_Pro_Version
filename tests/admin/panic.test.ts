import { generateSync } from "otplib";
import { NextRequest } from "next/server";

function makeTotp(secret: string): string {
	return generateSync({ secret, strategy: "totp" });
}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D6 (rate limit + timing-safe compare) + D11 (step-up TOTP) for /api/admin/panic.
 *
 * The handler reaches several side-effects (audit write, JWT version bump,
 * email send). We mock them so the test runs hermetically.
 */

const bumpAdminJwtVersion = vi.fn<() => Promise<number>>(async () => 7);
const getAdminJwtKid = vi.fn<() => Promise<string | null>>(async () => null);
const setAdminJwtKid = vi.fn<(kid: string) => Promise<void>>(async () => {});
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(
	async () => {},
);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(
	async () => true,
);
const sendHtmlEmailLogged = vi.fn<(...args: unknown[]) => Promise<void>>(
	async () => {},
);
const getAdminNotificationRecipients = vi.fn<() => string[]>(() => []);
const rlConsume = vi.fn<
	(args: unknown) => Promise<{ allowed: boolean; remaining: number; resetAt: Date }>
>(async () => ({
	allowed: true,
	remaining: 4,
	resetAt: new Date(Date.now() + 60_000),
}));

vi.mock("@/lib/admin/runtime-pg", () => ({
	bumpAdminJwtVersion,
	getAdminJwtKid,
	setAdminJwtKid,
}));

vi.mock("@/lib/admin/audit", () => ({
	writeAdminActionStrict,
	writeAdminAction,
}));

vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		PANIC_REVOKE_ALL: "panic_revoke_all",
		JWT_KID_ROTATED: "jwt_kid_rotated",
	},
}));

vi.mock("@/lib/email/send-html-email", () => ({
	sendHtmlEmailLogged,
}));

vi.mock("@/lib/env", () => ({
	getAdminNotificationRecipients,
}));

vi.mock("@/lib/ratelimit", () => ({
	rlConsume,
	rateLimitedResponse: (_result: unknown, _limit: number) =>
		new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 }),
}));

const PANIC_TOKEN = "test-panic-token-32bytes";
// Base32 secret ≥ 16 bytes (128 bits) — otplib enforces this minimum.
const TOTP_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

function buildRequest(opts: {
	token?: string | null;
	totp?: string | null;
	ip?: string;
	method?: "POST" | "GET";
}): NextRequest {
	const headers = new Headers();
	headers.set("x-forwarded-for", opts.ip ?? "203.0.113.99");
	if (opts.token !== null && opts.token !== undefined)
		headers.set("x-admin-panic-token", opts.token);
	if (opts.totp !== null && opts.totp !== undefined)
		headers.set("x-admin-panic-totp", opts.totp);
	return new NextRequest(new URL("http://localhost:3001/api/admin/panic"), {
		method: opts.method ?? "POST",
		headers,
	});
}

describe("/api/admin/panic — D6 + D11", () => {
	beforeEach(() => {
		process.env.ADMIN_PANIC_TOKEN = PANIC_TOKEN;
		process.env.ADMIN_TOTP_SECRET = TOTP_SECRET;
		// Clear any ADMIN_JWT_SECRET_v* env from prior tests so chooseNextAdminJwtKid
		// returns null (no fresh kid available) unless a specific test sets one.
		for (const k of Object.keys(process.env)) {
			if (k.startsWith("ADMIN_JWT_SECRET_")) delete process.env[k];
		}
		bumpAdminJwtVersion.mockClear();
		getAdminJwtKid.mockClear();
		getAdminJwtKid.mockResolvedValue(null);
		setAdminJwtKid.mockClear();
		writeAdminActionStrict.mockClear();
		writeAdminAction.mockClear();
		sendHtmlEmailLogged.mockClear();
		rlConsume.mockClear();
		rlConsume.mockResolvedValue({
			allowed: true,
			remaining: 4,
			resetAt: new Date(Date.now() + 60_000),
		});
		vi.resetModules();
	});

	afterEach(() => {
		delete process.env.ADMIN_PANIC_TOKEN;
		delete process.env.ADMIN_TOTP_SECRET;
	});

	it("D6: rate-limited request returns 429 without checking token", async () => {
		rlConsume.mockResolvedValueOnce({
			allowed: false,
			remaining: 0,
			resetAt: new Date(Date.now() + 60_000),
		});
		const { POST } = await import("@/app/api/admin/panic/route");
		const res = await POST(buildRequest({ token: PANIC_TOKEN, totp: makeTotp(TOTP_SECRET) }));
		expect(res.status).toBe(429);
		expect(bumpAdminJwtVersion).not.toHaveBeenCalled();
	});

	it("no token → 403", async () => {
		const { POST } = await import("@/app/api/admin/panic/route");
		const res = await POST(buildRequest({ token: null, totp: makeTotp(TOTP_SECRET) }));
		expect(res.status).toBe(403);
		expect(bumpAdminJwtVersion).not.toHaveBeenCalled();
	});

	it("D6 timing-safe compare: wrong token of same length → 403", async () => {
		const { POST } = await import("@/app/api/admin/panic/route");
		const wrong = "x".repeat(PANIC_TOKEN.length);
		const res = await POST(buildRequest({ token: wrong, totp: makeTotp(TOTP_SECRET) }));
		expect(res.status).toBe(403);
		expect(bumpAdminJwtVersion).not.toHaveBeenCalled();
	});

	it("D6 timing-safe compare: wrong token of different length → 403", async () => {
		const { POST } = await import("@/app/api/admin/panic/route");
		const res = await POST(buildRequest({ token: "short", totp: makeTotp(TOTP_SECRET) }));
		expect(res.status).toBe(403);
		expect(bumpAdminJwtVersion).not.toHaveBeenCalled();
	});

	it("D11: right token, missing TOTP secret env → 403", async () => {
		delete process.env.ADMIN_TOTP_SECRET;
		const { POST } = await import("@/app/api/admin/panic/route");
		const res = await POST(buildRequest({ token: PANIC_TOKEN, totp: "000000" }));
		expect(res.status).toBe(403);
		expect(bumpAdminJwtVersion).not.toHaveBeenCalled();
	});

	it("D11: right token, missing TOTP header → 403", async () => {
		const { POST } = await import("@/app/api/admin/panic/route");
		const res = await POST(buildRequest({ token: PANIC_TOKEN, totp: null }));
		expect(res.status).toBe(403);
		expect(bumpAdminJwtVersion).not.toHaveBeenCalled();
	});

	it("D11: right token, wrong TOTP → 403", async () => {
		const { POST } = await import("@/app/api/admin/panic/route");
		const res = await POST(buildRequest({ token: PANIC_TOKEN, totp: "000000" }));
		expect(res.status).toBe(403);
		expect(bumpAdminJwtVersion).not.toHaveBeenCalled();
	});

	it("D11: right token + right TOTP → 200, bumps jwt version, audits strictly", async () => {
		const totp = makeTotp(TOTP_SECRET);
		const { POST } = await import("@/app/api/admin/panic/route");
		const res = await POST(buildRequest({ token: PANIC_TOKEN, totp }));
		expect(res.status).toBe(200);
		expect(bumpAdminJwtVersion).toHaveBeenCalledTimes(1);
		expect(writeAdminActionStrict).toHaveBeenCalledTimes(1);
		const auditCall = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { jwt_version: number; from_kid: string | null; to_kid: string | null };
			totpUsed: boolean;
		};
		expect(auditCall.action).toBe("panic_revoke_all");
		expect(auditCall.payload.jwt_version).toBe(7);
		expect(auditCall.totpUsed).toBe(true);
		// No ADMIN_JWT_SECRET_v* configured in this test → kid stays null.
		expect(auditCall.payload.from_kid).toBeNull();
		expect(auditCall.payload.to_kid).toBeNull();
		expect(setAdminJwtKid).not.toHaveBeenCalled();
	});

	it("D4/D12: panic rotates kid when a fresh ADMIN_JWT_SECRET_v* is configured", async () => {
		process.env.ADMIN_JWT_SECRET_v1 = "first-test-secret-32bytes-long-padding-x";
		const totp = makeTotp(TOTP_SECRET);
		const { POST } = await import("@/app/api/admin/panic/route");
		const res = await POST(buildRequest({ token: PANIC_TOKEN, totp }));
		expect(res.status).toBe(200);
		expect(setAdminJwtKid).toHaveBeenCalledWith("v1");
		const auditCall = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			payload: { from_kid: string | null; to_kid: string | null };
		};
		expect(auditCall.payload.from_kid).toBeNull();
		expect(auditCall.payload.to_kid).toBe("v1");
		// The kid-rotation audit row (non-strict) should also fire.
		const kidAudit = writeAdminAction.mock.calls.find(
			(c) => (c[0] as unknown as { action: string }).action === "jwt_kid_rotated",
		);
		expect(kidAudit).toBeDefined();
		delete process.env.ADMIN_JWT_SECRET_v1;
	});

	it("D4/D12: panic skips kid rotation when no fresh kid env is configured", async () => {
		const totp = makeTotp(TOTP_SECRET);
		const { POST } = await import("@/app/api/admin/panic/route");
		const res = await POST(buildRequest({ token: PANIC_TOKEN, totp }));
		expect(res.status).toBe(200);
		expect(setAdminJwtKid).not.toHaveBeenCalled();
		const kidAudit = writeAdminAction.mock.calls.find(
			(c) => (c[0] as unknown as { action: string }).action === "jwt_kid_rotated",
		);
		expect(kidAudit).toBeUndefined();
	});

	it("GET also works with header-based token + TOTP", async () => {
		const totp = makeTotp(TOTP_SECRET);
		const { GET } = await import("@/app/api/admin/panic/route");
		const res = await GET(buildRequest({ token: PANIC_TOKEN, totp, method: "GET" }));
		expect(res.status).toBe(200);
		expect(bumpAdminJwtVersion).toHaveBeenCalledTimes(1);
	});

	it("D6 rate-limit key is per-IP", async () => {
		rlConsume.mockResolvedValue({
			allowed: true,
			remaining: 4,
			resetAt: new Date(Date.now() + 60_000),
		});
		const { POST } = await import("@/app/api/admin/panic/route");
		const totp = makeTotp(TOTP_SECRET);
		await POST(buildRequest({ token: PANIC_TOKEN, totp, ip: "203.0.113.10" }));
		await POST(buildRequest({ token: PANIC_TOKEN, totp, ip: "198.51.100.55" }));
		const keys = rlConsume.mock.calls.map(
			(c) => (c[0] as unknown as { key: string }).key,
		);
		expect(keys[0]).toBe("admin-panic:ip:203.0.113.10");
		expect(keys[1]).toBe("admin-panic:ip:198.51.100.55");
	});
});
