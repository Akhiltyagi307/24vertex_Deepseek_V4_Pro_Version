/**
 * Constraint-aware Drizzle ↔ Postgres FK parity check (review finding D4 / M6).
 *
 * The existing parity check (check-drizzle-postgres-parity.mjs) compares table +
 * column NAMES only, so it cannot catch the real drift class: a Drizzle
 * `.references()` whose target table or ON DELETE action disagrees with the live
 * DB, or a DB FK the hand-maintained mirror never declared. This check diffs the
 * actual foreign keys.
 *
 * Three buckets:
 *   - MISMATCH  — declared in Drizzle AND present in DB, but ref-table or onDelete
 *                 differ. These are bugs (the mirror lies, or the DB drifted).
 *   - PHANTOM   — declared in Drizzle but NOT in the DB. A `db:push` would try to
 *                 create it; reasoning about it is wrong.
 *   - OMISSION  — present in the DB but not declared in Drizzle (the mirror is
 *                 lossy). Advisory — this is the M6 hand-backfill backlog.
 *
 * Exit: 0 (advisory). With `--strict`, exits 1 on any MISMATCH or PHANTOM
 * (OMISSIONs stay advisory until the mirror is fully backfilled).
 *
 * Run: `FK_PARITY_DOTENV=/abs/path/.env.local pnpm db:check-fk-parity`
 * (or set DATABASE_URL in the environment).
 */
import { config } from "dotenv";

config({ path: process.env.FK_PARITY_DOTENV ?? ".env.local" });

import { getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import postgres from "postgres";

import * as schema from "../src/db/schema";

/** Last path segment, so "auth.users"/"public.tests" compare to "users"/"tests". */
function baseName(qualified: string): string {
	const parts = qualified.split(".");
	return parts[parts.length - 1]!.replace(/"/g, "");
}

function normOnDelete(v: unknown): string {
	return (typeof v === "string" && v.length > 0 ? v : "no action").toLowerCase();
}

type FkRef = { ref: string; onDelete: string };

async function main(): Promise<void> {
	const url = process.env.DATABASE_URL;
	if (!url) {
		console.error("check-fk-parity: DATABASE_URL not set (set FK_PARITY_DOTENV to your .env.local).");
		process.exit(2);
	}
	const sql = postgres(url, { prepare: false, max: 1 });

	try {
		const dbRows = (await sql`
			SELECT con.conrelid::regclass::text AS tbl,
			       att.attname AS col,
			       (con.confrelid::regclass)::text AS ref,
			       CASE con.confdeltype
			         WHEN 'a' THEN 'no action' WHEN 'r' THEN 'restrict' WHEN 'c' THEN 'cascade'
			         WHEN 'n' THEN 'set null' WHEN 'd' THEN 'set default' END AS on_delete
			FROM pg_constraint con
			JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
			WHERE con.contype = 'f' AND con.connamespace = 'public'::regnamespace
			ORDER BY 1, 2
		`) as unknown as { tbl: string; col: string; ref: string; on_delete: string }[];

		const dbMap = new Map<string, FkRef>();
		for (const r of dbRows) {
			dbMap.set(`${baseName(r.tbl)}|${r.col}`, { ref: baseName(r.ref), onDelete: normOnDelete(r.on_delete) });
		}

		const drizzleMap = new Map<string, FkRef>();
		for (const v of Object.values(schema)) {
			if (!is(v, PgTable)) continue;
			const tbl = getTableName(v);
			for (const fk of getTableConfig(v).foreignKeys) {
				const reference = fk.reference();
				const refTable = getTableName(reference.foreignTable);
				const onDelete = normOnDelete((fk as { onDelete?: string }).onDelete);
				for (const col of reference.columns) {
					drizzleMap.set(`${tbl}|${col.name}`, { ref: refTable, onDelete });
				}
			}
		}

		const mismatch: string[] = [];
		const phantom: string[] = [];
		const omission: string[] = [];

		for (const [key, dz] of drizzleMap) {
			const db = dbMap.get(key);
			if (!db) {
				phantom.push(`${key} -> ${dz.ref} (${dz.onDelete}) declared in Drizzle but absent in DB`);
			} else if (db.ref !== dz.ref || db.onDelete !== dz.onDelete) {
				mismatch.push(`${key}: Drizzle=${dz.ref}/${dz.onDelete}  DB=${db.ref}/${db.onDelete}`);
			}
		}
		for (const [key, db] of dbMap) {
			if (!drizzleMap.has(key)) omission.push(`${key} -> ${db.ref} (${db.onDelete})`);
		}

		console.log(`FK parity: ${dbMap.size} DB FKs vs ${drizzleMap.size} Drizzle FKs\n`);
		console.log(`MISMATCH (declared wrong) ............ ${mismatch.length}`);
		for (const m of mismatch) console.log(`  ✗ ${m}`);
		console.log(`PHANTOM (in Drizzle, not in DB) ...... ${phantom.length}`);
		for (const p of phantom) console.log(`  ✗ ${p}`);
		console.log(`OMISSION (in DB, not in Drizzle) ..... ${omission.length}  [advisory — M6 backlog]`);
		for (const o of omission) console.log(`  · ${o}`);

		const hardFailures = mismatch.length + phantom.length;
		if (process.argv.includes("--strict") && hardFailures > 0) {
			console.error(`\ncheck-fk-parity: FAIL — ${hardFailures} mismatch/phantom FK(s).`);
			process.exit(1);
		}
		console.log(`\ncheck-fk-parity: OK (advisory). ${hardFailures} mismatch/phantom, ${omission.length} omissions.`);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

void main();
