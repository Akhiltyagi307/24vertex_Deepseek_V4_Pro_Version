import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { writeAdminAction } from "@/lib/admin/audit";
import { verifyAdminTotpIfConfigured } from "@/lib/admin/auth";
import { requireAdminApi } from "@/lib/admin/api-auth";
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

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

function sqlWriteEnabled(): boolean {
	const v = process.env.ADMIN_SQL_WRITE_ENABLED?.trim().toLowerCase();
	return v === "true" || v === "1" || v === "yes";
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
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
		}
		const parsed = bodySchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
		}

		const { sql: rawSql, writable, totp } = parsed.data;

		if (writable) {
			if (!sqlWriteEnabled()) {
				return NextResponse.json(
					{
						error:
							"Writable SQL is disabled. Set ADMIN_SQL_WRITE_ENABLED=true and ADMIN_SQL_WRITE_ALLOWLIST_TABLES on the server.",
					},
					{ status: 403, headers: adminHeaders() },
				);
			}

			if (!verifyAdminTotpIfConfigured(totp)) {
				return NextResponse.json(
					{ error: "Valid TOTP required for writable SQL when ADMIN_TOTP_SECRET is set" },
					{ status: 400, headers: adminHeaders() },
				);
			}

			const allow = parseAllowlistTablesEnv(process.env.ADMIN_SQL_WRITE_ALLOWLIST_TABLES);
			if (allow.size === 0) {
				return NextResponse.json(
					{ error: "ADMIN_SQL_WRITE_ALLOWLIST_TABLES must list at least one table when write mode is enabled" },
					{ status: 403, headers: adminHeaders() },
				);
			}

			const inner = stripTrailingSemicolons(rawSql);
			const parsedWrite = parseWritableAdminSql(rawSql, allow);
			if (!parsedWrite.ok) {
				return NextResponse.json({ error: parsedWrite.error }, { status: 400, headers: adminHeaders() });
			}

			await writeAdminAction({
				action: "sql_console_execute_write",
				payload: {
					verb: parsedWrite.verb,
					table: parsedWrite.table,
					statement_hash: parsedWrite.statementHash,
				},
				userAgent: request.headers.get("user-agent"),
				totpUsed: Boolean(totp?.trim()),
			});

			try {
				const rows = await db.execute(sql.raw(inner));
				const list = Array.from(rows as Iterable<Record<string, unknown>>);
				return NextResponse.json(
					{
						data: {
							rows: list.slice(0, ADMIN_SQL_MAX_RESULT_ROWS),
							row_count: list.length,
							mode: "write",
						},
					},
					{ headers: adminHeaders() },
				);
			} catch (e) {
				const msg = e instanceof Error ? e.message : "Query failed";
				return NextResponse.json({ error: msg }, { status: 400, headers: adminHeaders() });
			}
		}

		const ro = assertReadOnlySelect(rawSql);
		if (!ro.ok) {
			return NextResponse.json({ error: ro.error }, { status: 400, headers: adminHeaders() });
		}

		const cost = await explainTotalCost(ro.sql);
		if (!cost.ok) {
			return NextResponse.json({ error: cost.error }, { status: 400, headers: adminHeaders() });
		}
		const maxCost = Number.parseFloat(process.env.ADMIN_SQL_MAX_PLAN_COST ?? "100000");
		if (Number.isFinite(maxCost) && cost.totalCost > maxCost) {
			return NextResponse.json(
				{ error: `Plan cost ${cost.totalCost.toFixed(2)} exceeds limit ${maxCost}` },
				{ status: 400, headers: adminHeaders() },
			);
		}

		const preview = ro.sql.slice(0, 500);
		await writeAdminAction({
			action: "sql_console_execute",
			payload: { preview, plan_cost: cost.totalCost },
			userAgent: request.headers.get("user-agent"),
		});

		try {
			const rows = await db.execute(sql.raw(ro.sql));
			const list = Array.from(rows as Iterable<Record<string, unknown>>);
			return NextResponse.json(
				{
					data: {
						rows: list.slice(0, ADMIN_SQL_MAX_RESULT_ROWS),
						row_count: list.length,
						plan_cost: cost.totalCost,
						mode: "read",
					},
				},
				{ headers: adminHeaders() },
			);
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Query failed";
			return NextResponse.json({ error: msg }, { status: 400, headers: adminHeaders() });
		}
	});
}
