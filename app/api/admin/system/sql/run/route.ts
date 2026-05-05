import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction, writeAdminActionStrict } from "@/lib/admin/audit";
import { verifyAdminTotpIfConfigured } from "@/lib/admin/auth";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { ADMIN_SQL_MAX_RESULT_ROWS, assertReadOnlySelect, stripTrailingSemicolons } from "@/lib/admin/sql/read-only";
import { explainTotalCost } from "@/lib/admin/sql/explain";
import { parseAllowlistTablesEnv, parseWritableAdminSql } from "@/lib/admin/sql/write-guard";
import { db } from "@/db";

export const runtime = "nodejs";

const bodySchema = z.object({
	sql: z.string().min(1).max(20_000),
	writable: z.boolean().optional(),
	totp: z.string().optional(),
});

function sqlWriteEnabled(): boolean {
	const v = process.env.ADMIN_SQL_WRITE_ENABLED?.trim().toLowerCase();
	return v === "true" || v === "1" || v === "yes";
}

function isAdminTotpSecretConfigured(): boolean {
	return Boolean(process.env.ADMIN_TOTP_SECRET?.trim());
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
			if (!totp?.trim() || !verifyAdminTotpIfConfigured(totp)) {
				return adminErrorResponse("Valid TOTP required for writable SQL");
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

			let list: Record<string, unknown>[];
			try {
				const rows = await db.execute(sql.raw(inner));
				list = Array.from(rows as Iterable<Record<string, unknown>>);
			} catch (e) {
				const msg = e instanceof Error ? e.message : "Query failed";
				return adminErrorResponse(msg);
			}

			// Strict audit: writable SQL is the highest-privilege operation in
			// the admin surface — every successful write needs a row in
			// admin_action_log, period.
			await writeAdminActionStrict({
				action: ADMIN_ACTIONS.SQL_CONSOLE_EXECUTE_WRITE,
				payload: {
					verb: parsedWrite.verb,
					table: parsedWrite.table,
					statement_hash: parsedWrite.statementHash,
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

		const ro = assertReadOnlySelect(rawSql);
		if (!ro.ok) return adminErrorResponse(ro.error);

		const cost = await explainTotalCost(ro.sql);
		if (!cost.ok) return adminErrorResponse(cost.error);
		const maxCost = Number.parseFloat(process.env.ADMIN_SQL_MAX_PLAN_COST ?? "100000");
		if (Number.isFinite(maxCost) && cost.totalCost > maxCost) {
			return adminErrorResponse(`Plan cost ${cost.totalCost.toFixed(2)} exceeds limit ${maxCost}`);
		}

		const preview = ro.sql.slice(0, 500);
		await writeAdminAction({
			action: ADMIN_ACTIONS.SQL_CONSOLE_EXECUTE,
			payload: { preview, plan_cost: cost.totalCost },
			userAgent: request.headers.get("user-agent"),
		});

		try {
			const rows = await db.execute(sql.raw(ro.sql));
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
		}
	});
}
