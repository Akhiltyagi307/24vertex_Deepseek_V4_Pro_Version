import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction, writeAdminActionStrict } from "@/lib/admin/audit";
import { consumeAdminTotp } from "@/lib/admin/auth";
import { requireAdminApi } from "@/lib/admin/api-auth";
import {
	adminActionScope,
	consumeAdminActionRateLimit,
} from "@/lib/admin/rate-limit-action";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { ADMIN_SQL_MAX_RESULT_ROWS, assertReadOnlySelect, stripTrailingSemicolons } from "@/lib/admin/sql/read-only";
import { explainTotalCost } from "@/lib/admin/sql/explain";
import { parseAllowlistTablesEnv, parseWritableAdminSql } from "@/lib/admin/sql/write-guard";
import { db } from "@/db";

export const runtime = "nodejs";

const bodySchema = z
	.object({
		sql: z.string().min(1).max(20_000),
		writable: z.boolean().optional(),
		totp: z.string().optional(),
	})
	.strict();

// D5 / SQL-2: per-admin rate-limit envelopes.
const SQL_READ_RATE_LIMIT_MAX = 30;
const SQL_WRITE_RATE_LIMIT_MAX = 10;
const SQL_RATE_LIMIT_WINDOW_SEC = 60;

// D5 / SQL-2: per-admin concurrent in-flight cap. Process-local Map keyed by jti.
// HA: each Node process has its own counter; DB plan-cost gate is the absolute
// backstop. With ~2 admins on a typical deployment, this is plenty.
const SQL_MAX_INFLIGHT_PER_JTI = 2;

// SQL-4: per-admin per-minute plan-cost budget. Each admin can spend at most
// this many cost-units of read-mode planning per rolling window. Process-local.
const SQL_PLAN_COST_BUDGET_PER_MIN = 1_000_000;
const SQL_PLAN_COST_WINDOW_MS = 60_000;

const globalForSqlConsole = globalThis as unknown as {
	__vertex24AdminSqlInflight?: Map<string, number>;
	__vertex24AdminSqlPlanCost?: Map<string, { windowStart: number; totalCost: number }>;
};

const sqlInflight: Map<string, number> = globalForSqlConsole.__vertex24AdminSqlInflight ?? new Map();
if (!globalForSqlConsole.__vertex24AdminSqlInflight) {
	globalForSqlConsole.__vertex24AdminSqlInflight = sqlInflight;
}

const sqlPlanCostByJti: Map<string, { windowStart: number; totalCost: number }> =
	globalForSqlConsole.__vertex24AdminSqlPlanCost ?? new Map();
if (!globalForSqlConsole.__vertex24AdminSqlPlanCost) {
	globalForSqlConsole.__vertex24AdminSqlPlanCost = sqlPlanCostByJti;
}

function sqlWriteEnabled(): boolean {
	const v = process.env.ADMIN_SQL_WRITE_ENABLED?.trim().toLowerCase();
	return v === "true" || v === "1" || v === "yes";
}

function isAdminTotpSecretConfigured(): boolean {
	return Boolean(process.env.ADMIN_TOTP_SECRET?.trim());
}

function tryReserveInflight(jti: string): boolean {
	const current = sqlInflight.get(jti) ?? 0;
	if (current >= SQL_MAX_INFLIGHT_PER_JTI) return false;
	sqlInflight.set(jti, current + 1);
	return true;
}

function releaseInflight(jti: string): void {
	const current = sqlInflight.get(jti) ?? 0;
	if (current <= 1) {
		sqlInflight.delete(jti);
	} else {
		sqlInflight.set(jti, current - 1);
	}
}

/**
 * SQL-4: charge the per-admin plan-cost budget. Refreshes the rolling window
 * when it's older than `SQL_PLAN_COST_WINDOW_MS`. Returns `false` if the new
 * charge would exceed the budget.
 */
function chargePlanCostBudget(jti: string, cost: number): boolean {
	const now = Date.now();
	const entry = sqlPlanCostByJti.get(jti);
	if (!entry || now - entry.windowStart >= SQL_PLAN_COST_WINDOW_MS) {
		if (cost > SQL_PLAN_COST_BUDGET_PER_MIN) return false;
		sqlPlanCostByJti.set(jti, { windowStart: now, totalCost: cost });
		return true;
	}
	if (entry.totalCost + cost > SQL_PLAN_COST_BUDGET_PER_MIN) return false;
	entry.totalCost += cost;
	return true;
}

export async function POST(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return adminErrorResponse("Invalid JSON");
		}
		const parsed = bodySchema.safeParse(body);
		if (!parsed.success) {
			return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
		}

		const { sql: rawSql, writable, totp } = parsed.data;
		const scopeKey = adminActionScope({ jti: gate.jti });

		if (writable) {
			if (!sqlWriteEnabled()) {
				return adminErrorResponse(
					"Writable SQL is disabled. Set ADMIN_SQL_WRITE_ENABLED=true and ADMIN_SQL_WRITE_ALLOWLIST_TABLES on the server.",
					{ status: 403 },
				);
			}

			// Hardening: writable SQL must always require TOTP. Previously, when
			// `ADMIN_TOTP_SECRET` was unset, `verifyAdminTotpIfConfigured` returned
			// true (no secret to compare against) and the check fell through. That
			// meant an admin without 2FA could run INSERT/UPDATE/DELETE just by
			// having `ADMIN_SQL_WRITE_ENABLED=true` and a valid session cookie.
			// Now: if no secret is configured, refuse — operators must enroll TOTP
			// before they can execute writes. If configured, the token must verify.
			if (!isAdminTotpSecretConfigured()) {
				return adminErrorResponse("ADMIN_TOTP_SECRET must be configured before writable SQL can run", {
					status: 403,
				});
			}
			if (!totp?.trim() || !(await consumeAdminTotp(totp))) {
				return adminErrorResponse("Valid TOTP required for writable SQL");
			}

			// D5 / SQL-2: per-admin rate limit on writable SQL.
			const rlWrite = await consumeAdminActionRateLimit({
				action: ADMIN_ACTIONS.SQL_CONSOLE_EXECUTE_WRITE,
				scope: scopeKey,
				limit: SQL_WRITE_RATE_LIMIT_MAX,
				windowSec: SQL_RATE_LIMIT_WINDOW_SEC,
			});
			if (!rlWrite.allowed) {
				return adminErrorResponse("Too many writable SQL executions. Slow down.", {
					status: 429,
					code: "rate_limited",
					headers: {
						"Retry-After": String(
							Math.max(0, Math.ceil((rlWrite.resetAt.getTime() - Date.now()) / 1000)),
						),
					},
				});
			}

			const allow = parseAllowlistTablesEnv(process.env.ADMIN_SQL_WRITE_ALLOWLIST_TABLES);
			if (allow.size === 0) {
				return adminErrorResponse(
					"ADMIN_SQL_WRITE_ALLOWLIST_TABLES must list at least one table when write mode is enabled",
					{ status: 403 },
				);
			}

			const inner = stripTrailingSemicolons(rawSql);
			const parsedWrite = parseWritableAdminSql(rawSql, allow);
			if (!parsedWrite.ok) return adminErrorResponse(parsedWrite.error);

			if (!tryReserveInflight(gate.jti)) {
				return adminErrorResponse("Too many SQL executions in flight. Wait for in-progress queries.", {
					status: 429,
					code: "sql_concurrent_limit",
				});
			}
			let list: Record<string, unknown>[];
			try {
				const rows = await db.execute(sql.raw(inner));
				list = Array.from(rows as Iterable<Record<string, unknown>>);
			} catch (e) {
				const msg = e instanceof Error ? e.message : "Query failed";
				return adminErrorResponse(msg);
			} finally {
				releaseInflight(gate.jti);
			}

			// D31 / SQL-3: writable SQL must include a RETURNING clause (enforced
			// in parseWritableAdminSql). The returned rows ARE the audit diff —
			// for INSERT they are the new rows, for UPDATE they are the new
			// state (we accept loss of "before" pending a WHERE-clause parser),
			// and for DELETE they are the rows that were deleted. Cap at 100
			// rows so the audit row stays a reasonable size in JSONB.
			const ADMIN_SQL_AUDIT_DIFF_MAX_ROWS = 100;
			const diffRows = list.slice(0, ADMIN_SQL_AUDIT_DIFF_MAX_ROWS);
			const diffTruncated = list.length > ADMIN_SQL_AUDIT_DIFF_MAX_ROWS;

			// Strict audit: writable SQL is the highest-privilege operation in
			// the admin surface — every successful write needs a row in
			// admin_action_log, period.
			await writeAdminActionStrict({
				action: ADMIN_ACTIONS.SQL_CONSOLE_EXECUTE_WRITE,
				payload: {
					verb: parsedWrite.verb,
					table: parsedWrite.table,
					statement_hash: parsedWrite.statementHash,
					diff: {
						verb: parsedWrite.verb,
						rows: diffRows,
						row_count: list.length,
						truncated: diffTruncated,
					},
				},
				userAgent: request.headers.get("user-agent"),
				totpUsed: Boolean(totp?.trim()),
			});

			return adminDetailResponse({
				rows: list.slice(0, ADMIN_SQL_MAX_RESULT_ROWS),
				row_count: list.length,
				mode: "write",
			});
		}

		// D5 / SQL-2: per-admin rate limit on read-mode SQL.
		const rlRead = await consumeAdminActionRateLimit({
			action: ADMIN_ACTIONS.SQL_CONSOLE_EXECUTE,
			scope: scopeKey,
			limit: SQL_READ_RATE_LIMIT_MAX,
			windowSec: SQL_RATE_LIMIT_WINDOW_SEC,
		});
		if (!rlRead.allowed) {
			return adminErrorResponse("Too many SQL executions. Slow down.", {
				status: 429,
				code: "rate_limited",
				headers: {
					"Retry-After": String(
						Math.max(0, Math.ceil((rlRead.resetAt.getTime() - Date.now()) / 1000)),
					),
				},
			});
		}

		const ro = assertReadOnlySelect(rawSql);
		if (!ro.ok) return adminErrorResponse(ro.error);

		const cost = await explainTotalCost(ro.sql);
		if (!cost.ok) return adminErrorResponse(cost.error);
		const maxCost = Number.parseFloat(process.env.ADMIN_SQL_MAX_PLAN_COST ?? "100000");
		if (Number.isFinite(maxCost) && cost.totalCost > maxCost) {
			return adminErrorResponse(`Plan cost ${cost.totalCost.toFixed(2)} exceeds limit ${maxCost}`);
		}

		// SQL-4: per-admin minute-window plan-cost budget. A single statement is
		// already gated by ADMIN_SQL_MAX_PLAN_COST; this gates the cumulative
		// budget so a query author can't sustain expensive queries even if each
		// is individually within the per-statement cap.
		if (!chargePlanCostBudget(gate.jti, cost.totalCost)) {
			return adminErrorResponse(
				`Per-minute plan-cost budget exceeded for this admin session (limit ${SQL_PLAN_COST_BUDGET_PER_MIN}). Wait for the window to reset.`,
				{ status: 429, code: "sql_plan_cost_budget" },
			);
		}

		// D5 / SQL-2: concurrent in-flight cap for read-mode.
		if (!tryReserveInflight(gate.jti)) {
			return adminErrorResponse("Too many SQL executions in flight. Wait for in-progress queries.", {
				status: 429,
				code: "sql_concurrent_limit",
			});
		}

		const preview = ro.sql.slice(0, 500);
		await writeAdminAction({
			action: ADMIN_ACTIONS.SQL_CONSOLE_EXECUTE,
			payload: { preview, plan_cost: cost.totalCost },
			userAgent: request.headers.get("user-agent"),
		});

		try {
			// D2 / SQL-1: the parser-side `assertReadOnlySelect` rejects CTE-with-DML
			// lexically, but Postgres's transaction-level read-only flag is the
			// authoritative guard. Wrapping the user statement inside a transaction
			// that begins with `SET TRANSACTION READ ONLY` makes any DML — including
			// DML hidden inside a CTE or behind a function — fail at execution time.
			// Drizzle returns the callback's value from `db.transaction`; the
			// transaction commits if the callback resolves and rolls back on throw.
			const rows = await db.transaction(async (tx) => {
				await tx.execute(sql.raw("SET TRANSACTION READ ONLY"));
				return await tx.execute(sql.raw(ro.sql));
			});
			const list = Array.from(rows as Iterable<Record<string, unknown>>);
			return adminDetailResponse({
				rows: list.slice(0, ADMIN_SQL_MAX_RESULT_ROWS),
				row_count: list.length,
				plan_cost: cost.totalCost,
				mode: "read",
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Query failed";
			return adminErrorResponse(msg);
		} finally {
			releaseInflight(gate.jti);
		}
	});
}
