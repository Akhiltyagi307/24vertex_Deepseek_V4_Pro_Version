import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const verifyAdminTotpIfConfigured = vi.fn(() => true);
const consumeAdminActionRateLimit = vi.fn(async () => ({
	allowed: true,
	resetAt: new Date(Date.now() + 60_000),
	remaining: 9,
}));
const assertReadOnlySelect = vi.fn<
	() => { ok: true } | { ok: false; reason: string }
>(() => ({ ok: true }));
const stripTrailingSemicolons = vi.fn((s: string) => s);
const explainTotalCost = vi.fn(async () => 100);
const parseAllowlistTablesEnv = vi.fn(() => new Set<string>());
const parseWritableAdminSql = vi.fn<
	() =>
		| { ok: false; error: string }
		| { ok: true; verb: string; table: string; statementHash: string }
>(() => ({ ok: false, error: "Write parser not exercised here" }));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction, writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		SQL_CONSOLE_EXECUTE_READ: "sql_console_execute_read",
		SQL_CONSOLE_EXECUTE_WRITE: "sql_console_execute_write",
	},
}));
vi.mock("@/lib/admin/auth", () => ({ verifyAdminTotpIfConfigured }));
vi.mock("@/lib/admin/rate-limit-action", () => ({
	adminActionScope: ({ jti }: { jti: string }) => jti,
	consumeAdminActionRateLimit,
}));
vi.mock("@/lib/admin/sql/read-only", () => ({
	ADMIN_SQL_MAX_RESULT_ROWS: 1000,
	assertReadOnlySelect,
	stripTrailingSemicolons,
}));
vi.mock("@/lib/admin/sql/explain", () => ({ explainTotalCost }));
vi.mock("@/lib/admin/sql/write-guard", () => ({
	parseAllowlistTablesEnv,
	parseWritableAdminSql,
}));
vi.mock("@/db", () => ({
	db: {
		transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
			cb({
				execute: vi.fn(async () => [{ a: 1 }, { a: 2 }]),
			}),
		),
		execute: vi.fn(async () => [{ ok: true }]),
	},
}));

describe("D32 Sprint C · POST /api/admin/system/sql/run (route handler)", () => {
	beforeEach(() => {
		// Reset in-process global state between tests so the in-flight + plan-cost
		// counters from a prior case don't leak into the next.
		const g = globalThis as unknown as {
			__eduAiAdminSqlInflight?: Map<string, number>;
			__eduAiAdminSqlPlanCost?: Map<string, { windowStart: number; totalCost: number }>;
		};
		g.__eduAiAdminSqlInflight?.clear();
		g.__eduAiAdminSqlPlanCost?.clear();
	});

	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		writeAdminActionStrict.mockClear();
		verifyAdminTotpIfConfigured.mockClear();
		verifyAdminTotpIfConfigured.mockReturnValue(true);
		consumeAdminActionRateLimit.mockClear();
		consumeAdminActionRateLimit.mockResolvedValue({
			allowed: true,
			resetAt: new Date(Date.now() + 60_000),
			remaining: 9,
		});
		assertReadOnlySelect.mockReset();
		assertReadOnlySelect.mockReturnValue({ ok: true });
		stripTrailingSemicolons.mockClear();
		stripTrailingSemicolons.mockImplementation((s: string) => s);
		explainTotalCost.mockReset();
		explainTotalCost.mockResolvedValue(100);
		parseAllowlistTablesEnv.mockClear();
		parseWritableAdminSql.mockReset();
		parseWritableAdminSql.mockReturnValue({ ok: false, error: "boom" });
		delete process.env.ADMIN_SQL_WRITE_ENABLED;
		delete process.env.ADMIN_TOTP_SECRET;
		delete process.env.ADMIN_SQL_WRITE_ALLOWLIST_TABLES;
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/system/sql/run/route");
		const res = await POST(
			adminRequest("/api/admin/system/sql/run", {
				method: "POST",
				body: { sql: "SELECT 1" },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("400 when body fails schema", async () => {
		const { POST } = await import("@/app/api/admin/system/sql/run/route");
		const res = await POST(
			adminRequest("/api/admin/system/sql/run", { method: "POST", body: { wrong: true } }),
		);
		expect(res.status).toBe(400);
	});

	it("403 when writable requested but ADMIN_SQL_WRITE_ENABLED is unset", async () => {
		const { POST } = await import("@/app/api/admin/system/sql/run/route");
		const res = await POST(
			adminRequest("/api/admin/system/sql/run", {
				method: "POST",
				body: { sql: "UPDATE x SET y=1 RETURNING *", writable: true, totp: "123456" },
			}),
		);
		expect(res.status).toBe(403);
	});

	it("403 writable + flag-on but ADMIN_TOTP_SECRET unset", async () => {
		process.env.ADMIN_SQL_WRITE_ENABLED = "true";
		const { POST } = await import("@/app/api/admin/system/sql/run/route");
		const res = await POST(
			adminRequest("/api/admin/system/sql/run", {
				method: "POST",
				body: { sql: "UPDATE x SET y=1 RETURNING *", writable: true, totp: "123456" },
			}),
		);
		expect(res.status).toBe(403);
	});

	it("400 writable + TOTP secret set but missing/bad totp body", async () => {
		process.env.ADMIN_SQL_WRITE_ENABLED = "true";
		process.env.ADMIN_TOTP_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
		verifyAdminTotpIfConfigured.mockReturnValueOnce(false);
		const { POST } = await import("@/app/api/admin/system/sql/run/route");
		const res = await POST(
			adminRequest("/api/admin/system/sql/run", {
				method: "POST",
				body: { sql: "UPDATE x SET y=1 RETURNING *", writable: true, totp: "bad" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("429 when rate limit exhausted (read)", async () => {
		consumeAdminActionRateLimit.mockResolvedValueOnce({
			allowed: false,
			resetAt: new Date(Date.now() + 30_000),
			remaining: 0,
		});
		const { POST } = await import("@/app/api/admin/system/sql/run/route");
		const res = await POST(
			adminRequest("/api/admin/system/sql/run", {
				method: "POST",
				body: { sql: "SELECT 1" },
			}),
		);
		expect(res.status).toBe(429);
	});

	it("400 when read-only assertion rejects DML disguised as CTE", async () => {
		assertReadOnlySelect.mockReturnValueOnce({ ok: false, reason: "DML inside CTE" });
		const { POST } = await import("@/app/api/admin/system/sql/run/route");
		const res = await POST(
			adminRequest("/api/admin/system/sql/run", {
				method: "POST",
				body: { sql: "WITH x AS (DELETE FROM t RETURNING 1) SELECT * FROM x" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("403 writable + flag-on + TOTP + no allowlist tables", async () => {
		process.env.ADMIN_SQL_WRITE_ENABLED = "true";
		process.env.ADMIN_TOTP_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
		const { POST } = await import("@/app/api/admin/system/sql/run/route");
		const res = await POST(
			adminRequest("/api/admin/system/sql/run", {
				method: "POST",
				body: { sql: "UPDATE x SET y=1 RETURNING *", writable: true, totp: "123456" },
			}),
		);
		expect(res.status).toBe(403);
	});
});
