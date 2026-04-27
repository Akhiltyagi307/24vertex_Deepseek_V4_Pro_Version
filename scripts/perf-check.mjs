#!/usr/bin/env node
/**
 * P3 recurring performance smoke: production build timing, optional DB round-trip,
 * optional HTTP timings against a running dev/prod server.
 *
 * Usage:
 *   pnpm perf:check
 *   PERF_SKIP_BUILD=1 pnpm perf:check          # after you already built
 *   PERF_BASE_URL=http://127.0.0.1:3001 pnpm perf:check   # needs `pnpm dev` in another shell
 *
 * Env:
 *   DATABASE_URL     — if set, runs SELECT 1 + lightweight count (best-effort)
 *   PERF_BASE_URL         — if set, GETs / and /login and reports wall time
 *   PERF_SKIP_BUILD       — if "1" or "true", skips `pnpm run build`
 *   PERF_ROUTE_BUDGET_MS  — if set (e.g. 1500), exit 1 when any probed route exceeds this many ms
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { config } from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env.local") });
config();

function fmtMs(ms) {
	return `${ms.toFixed(0)} ms`;
}

function runBuild() {
	const t0 = performance.now();
	const r = spawnSync("pnpm", ["run", "build"], {
		cwd: root,
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	const ms = performance.now() - t0;
	if (r.error) {
		console.error(r.error);
		process.exit(1);
	}
	if (r.status !== 0) {
		console.error(`\nperf:check: build exited with code ${r.status}`);
		process.exit(r.status ?? 1);
	}
	console.log(`\n[perf] next build: ${fmtMs(ms)}`);
}

async function runDbProbe() {
	const url = process.env.DATABASE_URL;
	if (!url) {
		console.log("[perf] DATABASE_URL not set — skipping DB timing");
		return;
	}
	try {
		const { default: postgres } = await import("postgres");
		const sql = postgres(url, { max: 1, prepare: false });
		const t0 = performance.now();
		await sql`select 1 as one`;
		const t1 = performance.now();
		console.log(`[perf] DB select 1: ${fmtMs(t1 - t0)}`);
		try {
			const t2 = performance.now();
			await sql`select count(*)::bigint as c from information_schema.tables where table_schema = 'public'`;
			const t3 = performance.now();
			console.log(`[perf] DB information_schema public tables count: ${fmtMs(t3 - t2)}`);
		} catch (e2) {
			console.error("[perf] DB secondary query skipped:", e2?.message ?? e2);
		}
		await sql.end({ timeout: 5 });
	} catch (e) {
		console.error("[perf] DB probe failed:", e?.message ?? e);
	}
}

async function runRouteProbe() {
	const base = process.env.PERF_BASE_URL?.replace(/\/$/, "");
	if (!base) {
		console.log("[perf] PERF_BASE_URL not set — skipping route timing (set e.g. http://127.0.0.1:3001)");
		return;
	}
	const paths = ["/", "/login"];
	const budgetRaw = process.env.PERF_ROUTE_BUDGET_MS;
	const budgetMs = budgetRaw ? Number.parseFloat(String(budgetRaw)) : 0;
	const budgetActive = Number.isFinite(budgetMs) && budgetMs > 0;
	let budgetFailed = false;

	for (const p of paths) {
		const url = `${base}${p}`;
		const t0 = performance.now();
		try {
			const res = await fetch(url, { redirect: "manual" });
			const ms = performance.now() - t0;
			console.log(`[perf] GET ${url} → ${res.status} in ${fmtMs(ms)}`);
			if (budgetActive && ms > budgetMs) {
				console.error(`[perf] BUDGET_FAIL: ${url} took ${fmtMs(ms)} (limit ${fmtMs(budgetMs)})`);
				budgetFailed = true;
			}
		} catch (e) {
			console.error(`[perf] GET ${url} failed:`, e?.message ?? e);
		}
	}

	if (budgetFailed) {
		console.error("[perf] One or more routes exceeded PERF_ROUTE_BUDGET_MS — exiting with code 1");
		process.exit(1);
	}
}

const skipBuild = ["1", "true", "yes"].includes(
	String(process.env.PERF_SKIP_BUILD ?? "").toLowerCase(),
);

async function main() {
	console.log("[perf] EduAI perf check —", new Date().toISOString());
	if (skipBuild) {
		console.log("[perf] PERF_SKIP_BUILD set — skipping build");
	} else {
		runBuild();
	}
	await runDbProbe();
	await runRouteProbe();
	console.log("[perf] done.\n");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
