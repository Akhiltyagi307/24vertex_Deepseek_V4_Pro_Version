#!/usr/bin/env node
/**
 * Compare local supabase/migrations/*.sql files to the remote
 * supabase_migrations.schema_migrations ledger.
 *
 * Exits 1 ONLY when a local file's version is NOT in the remote ledger —
 * that's the actually-dangerous case: an unapplied migration about to ship
 * with code that depends on it. Remote-only versions (archived branches) and
 * name mismatches (historical reconcile-ledger churn) are reported as
 * warnings but don't block deploys.
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Skips
 * cleanly when either is unset (forks without secrets, local invocation).
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
	console.log("check-migration-drift: SKIP (Supabase env not set)");
	process.exit(0);
}

const migrationsDir = join(process.cwd(), "supabase", "migrations");

function readLocalMigrations() {
	const files = readdirSync(migrationsDir).filter((f) => /^\d{14}_.*\.sql$/.test(f));
	return files.map((f) => {
		const m = f.match(/^(\d{14})_(.+)\.sql$/);
		return { version: m[1], name: m[2], file: f };
	});
}

async function readRemoteLedger() {
	const u = new URL(`${url}/rest/v1/supabase_migrations.schema_migrations`);
	u.searchParams.set("select", "version,name");
	u.searchParams.set("order", "version.desc");

	const res = await fetch(u.toString(), {
		headers: {
			apikey: key,
			Authorization: `Bearer ${key}`,
			Accept: "application/json",
		},
	});
	if (!res.ok) {
		throw new Error(`Failed to fetch ledger: ${res.status} ${await res.text().catch(() => "")}`);
	}
	const body = await res.json();
	if (!Array.isArray(body)) {
		throw new Error(`Unexpected ledger shape: ${typeof body}`);
	}
	return body;
}

let local, remote;
try {
	local = readLocalMigrations();
	remote = await readRemoteLedger();
} catch (e) {
	console.error(`check-migration-drift: ERROR — ${e.message}`);
	process.exit(1);
}

const remoteVersions = new Set(remote.map((r) => r.version));
const localVersions = new Set(local.map((l) => l.version));

// Critical: local file version not in remote → unapplied migration
const unapplied = local.filter((l) => !remoteVersions.has(l.version));

// Informational: remote version not in local files (archived branch / older work)
const remoteOnly = remote.filter((r) => !localVersions.has(r.version));

// Informational: same version, different name
const localByVersion = new Map(local.map((l) => [l.version, l]));
const renamed = remote
	.filter((r) => localByVersion.has(r.version) && localByVersion.get(r.version).name !== r.name)
	.map((r) => ({
		version: r.version,
		ledgerName: r.name,
		localName: localByVersion.get(r.version).name,
	}));

console.log(`Local migrations: ${local.length}`);
console.log(`Remote ledger: ${remote.length}`);

if (unapplied.length > 0) {
	console.error(`\n[FAIL] ${unapplied.length} local migration(s) NOT applied to remote ledger:`);
	for (const u of unapplied) console.error(`  - ${u.file}`);
	console.error("\nApply via Supabase MCP / CLI before merging code that depends on these.");
	process.exit(1);
}

if (remoteOnly.length > 0) {
	console.warn(`\n[WARN] ${remoteOnly.length} remote ledger entry(ies) not in local files (may be archived):`);
	for (const r of remoteOnly.slice(0, 5)) console.warn(`  - ${r.version} ${r.name}`);
	if (remoteOnly.length > 5) console.warn(`  - ... and ${remoteOnly.length - 5} more`);
}

if (renamed.length > 0) {
	console.warn(`\n[WARN] ${renamed.length} version(s) have a different name in the ledger vs local file:`);
	for (const r of renamed.slice(0, 5)) {
		console.warn(`  - ${r.version}: local "${r.localName}" vs ledger "${r.ledgerName}"`);
	}
	if (renamed.length > 5) console.warn(`  - ... and ${renamed.length - 5} more`);
}

console.log("\ncheck-migration-drift: OK (no unapplied migrations)");
