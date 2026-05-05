#!/usr/bin/env node
/**
 * Compare local supabase/migrations/*.sql files to the remote
 * supabase_migrations.schema_migrations ledger of one or both projects.
 *
 * EduAI runs two Supabase projects per the project rule: a production project
 * (A) and a dev/staging mirror (B). Schema must apply identically to both. A
 * migration that lands on A but not B is a latent CI break; one that lands on
 * B but not A is operator confusion the next time someone reconciles state.
 *
 * Required env (primary, kept for backward compat with existing CI):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env (secondary; when set, the script also diffs Project B and
 * reports any divergence between A and B):
 *   SECONDARY_SUPABASE_URL, SECONDARY_SUPABASE_SERVICE_ROLE_KEY
 *
 * Exit codes:
 *   0  no unapplied local migrations on either project
 *   1  one or more local migrations are missing on at least one remote ledger
 *
 * Remote-only versions (archived branches) and historical name churn between
 * the local file and the ledger entry are reported as warnings and do NOT
 * fail the build — those are informational and don't block deploys.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

function readEnv(...names) {
	for (const n of names) {
		const v = process.env[n];
		if (v && v.trim().length > 0) return v.trim();
	}
	return null;
}

const PRIMARY = {
	label: "primary",
	url: (readEnv("NEXT_PUBLIC_SUPABASE_URL") ?? "").replace(/\/+$/, ""),
	key: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
};

const SECONDARY = {
	label: "secondary",
	url: (readEnv("SECONDARY_SUPABASE_URL") ?? "").replace(/\/+$/, ""),
	key: readEnv("SECONDARY_SUPABASE_SERVICE_ROLE_KEY"),
};

if (!PRIMARY.url || !PRIMARY.key) {
	console.log("check-migration-drift: SKIP (primary Supabase env not set)");
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

async function readRemoteLedger(project) {
	const u = new URL(`${project.url}/rest/v1/supabase_migrations.schema_migrations`);
	u.searchParams.set("select", "version,name");
	u.searchParams.set("order", "version.desc");

	const res = await fetch(u.toString(), {
		headers: {
			apikey: project.key,
			Authorization: `Bearer ${project.key}`,
			Accept: "application/json",
		},
	});
	if (!res.ok) {
		throw new Error(`[${project.label}] failed to fetch ledger: ${res.status} ${await res.text().catch(() => "")}`);
	}
	const body = await res.json();
	if (!Array.isArray(body)) {
		throw new Error(`[${project.label}] unexpected ledger shape: ${typeof body}`);
	}
	return body;
}

function diffLocalVsRemote(local, remote, label) {
	const remoteVersions = new Set(remote.map((r) => r.version));
	const localVersions = new Set(local.map((l) => l.version));

	const unapplied = local.filter((l) => !remoteVersions.has(l.version));
	const remoteOnly = remote.filter((r) => !localVersions.has(r.version));

	const localByVersion = new Map(local.map((l) => [l.version, l]));
	const renamed = remote
		.filter((r) => localByVersion.has(r.version) && localByVersion.get(r.version).name !== r.name)
		.map((r) => ({
			version: r.version,
			ledgerName: r.name,
			localName: localByVersion.get(r.version).name,
		}));

	console.log(`\n[${label}] local migrations: ${local.length} | remote ledger: ${remote.length}`);

	if (unapplied.length > 0) {
		console.error(`[${label}] FAIL — ${unapplied.length} local migration(s) NOT applied:`);
		for (const u of unapplied) console.error(`  - ${u.file}`);
	}
	if (remoteOnly.length > 0) {
		console.warn(`[${label}] WARN — ${remoteOnly.length} remote ledger entry(ies) not in local files (archived?):`);
		for (const r of remoteOnly.slice(0, 5)) console.warn(`  - ${r.version} ${r.name}`);
		if (remoteOnly.length > 5) console.warn(`  - … and ${remoteOnly.length - 5} more`);
	}
	if (renamed.length > 0) {
		console.warn(`[${label}] WARN — ${renamed.length} version(s) have a different name vs local file:`);
		for (const r of renamed.slice(0, 5)) {
			console.warn(`  - ${r.version}: local "${r.localName}" vs ledger "${r.ledgerName}"`);
		}
		if (renamed.length > 5) console.warn(`  - … and ${renamed.length - 5} more`);
	}

	return { unapplied, remoteVersions };
}

function diffPrimaryVsSecondary(primaryRemoteVersions, secondaryRemoteVersions) {
	const onlyOnPrimary = [...primaryRemoteVersions].filter((v) => !secondaryRemoteVersions.has(v));
	const onlyOnSecondary = [...secondaryRemoteVersions].filter((v) => !primaryRemoteVersions.has(v));

	if (onlyOnPrimary.length === 0 && onlyOnSecondary.length === 0) {
		console.log("\n[primary↔secondary] OK — both ledgers have the same versions.");
		return false;
	}

	let bad = false;
	if (onlyOnPrimary.length > 0) {
		// Primary has versions secondary doesn't: someone applied to A but
		// forgot B. This is the most common drift mode and the one the
		// project rule is meant to prevent. Treat as FAIL so CI flags it.
		bad = true;
		console.error(`\n[primary↔secondary] FAIL — ${onlyOnPrimary.length} version(s) on primary but not secondary:`);
		for (const v of onlyOnPrimary.slice(0, 10)) console.error(`  - ${v}`);
		if (onlyOnPrimary.length > 10) console.error(`  - … and ${onlyOnPrimary.length - 10} more`);
	}
	if (onlyOnSecondary.length > 0) {
		// Secondary has versions primary doesn't: less alarming (a one-off
		// migration applied to staging while exploring) but still worth
		// surfacing as a warning.
		console.warn(`\n[primary↔secondary] WARN — ${onlyOnSecondary.length} version(s) on secondary but not primary:`);
		for (const v of onlyOnSecondary.slice(0, 10)) console.warn(`  - ${v}`);
		if (onlyOnSecondary.length > 10) console.warn(`  - … and ${onlyOnSecondary.length - 10} more`);
	}
	return bad;
}

async function main() {
	let local;
	try {
		local = readLocalMigrations();
	} catch (e) {
		console.error(`check-migration-drift: ERROR — ${e.message}`);
		process.exit(1);
	}

	let primaryFail = false;
	let primaryRemoteVersions = new Set();
	try {
		const remote = await readRemoteLedger(PRIMARY);
		const { unapplied, remoteVersions } = diffLocalVsRemote(local, remote, PRIMARY.label);
		primaryFail = unapplied.length > 0;
		primaryRemoteVersions = remoteVersions;
	} catch (e) {
		console.error(`check-migration-drift: ERROR — ${e.message}`);
		process.exit(1);
	}

	let secondaryFail = false;
	let secondaryConfigured = Boolean(SECONDARY.url && SECONDARY.key);
	let secondaryRemoteVersions = new Set();
	if (secondaryConfigured) {
		try {
			const remote = await readRemoteLedger(SECONDARY);
			const { unapplied, remoteVersions } = diffLocalVsRemote(local, remote, SECONDARY.label);
			secondaryFail = unapplied.length > 0;
			secondaryRemoteVersions = remoteVersions;
		} catch (e) {
			// A failed secondary read shouldn't block deploys — print a warning
			// and continue. If the secondary is genuinely down, primary checks
			// still ran and the operator gets the signal.
			console.warn(`[secondary] WARN — ${e.message}`);
			secondaryConfigured = false;
		}
	} else {
		console.log("\n[secondary] SKIP — SECONDARY_SUPABASE_URL / SECONDARY_SUPABASE_SERVICE_ROLE_KEY not set.");
	}

	let crossFail = false;
	if (secondaryConfigured) {
		crossFail = diffPrimaryVsSecondary(primaryRemoteVersions, secondaryRemoteVersions);
	}

	if (primaryFail || secondaryFail || crossFail) {
		console.error("\ncheck-migration-drift: FAIL — see above.");
		process.exit(1);
	}

	console.log("\ncheck-migration-drift: OK");
}

main().catch((e) => {
	console.error(`check-migration-drift: ERROR — ${e.message}`);
	process.exit(1);
});
