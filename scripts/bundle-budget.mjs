#!/usr/bin/env node
/**
 * Bundle budget gate. Reads `.next/app-build-manifest.json` produced by
 * `next build`, sums the gzipped JS payload per app route, and exits 1 when
 * any route exceeds its budget by more than the configured slack.
 *
 * Usage:
 *   pnpm exec node scripts/bundle-budget.mjs
 *   BUDGET_SLACK_PCT=10 pnpm exec node scripts/bundle-budget.mjs
 *   pnpm exec node scripts/bundle-budget.mjs --json   # machine-readable
 *
 * Why this script and not Next's built-in stats: Next's build output prints
 * "First Load JS" only when the route is statically generated. Dynamic routes
 * (most of `/admin`, `/student/practice/[testId]`) are missing from that
 * table, and our heaviest routes are dynamic. This script walks the
 * app-build-manifest directly so it covers both.
 *
 * Budgets are in **gzipped kilobytes**. Adjust at the top of this file.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEXT_DIR = path.join(root, ".next");

/** @type {Array<{ route: string; budgetKb: number; tier: "marketing" | "shell" | "feature" | "heavy" }>} */
const BUDGETS = [
	// Marketing landing has the biggest single-page payload after the auth-studio
	// reviewer / hero / animations land; stay under 95 KB to keep the LCP target.
	{ route: "/page", budgetKb: 95, tier: "marketing" },
	{ route: "/login/page", budgetKb: 80, tier: "shell" },
	{ route: "/auth/forgot-password/page", budgetKb: 75, tier: "shell" },
	{ route: "/student/dashboard/page", budgetKb: 130, tier: "feature" },
	{ route: "/student/practice/page", budgetKb: 200, tier: "feature" },
	{ route: "/student/practice/[testId]/page", budgetKb: 220, tier: "heavy" },
	{ route: "/student/doubt-chat/page", budgetKb: 200, tier: "feature" },
	{ route: "/parent/(portal)/dashboard/page", budgetKb: 130, tier: "feature" },
	{ route: "/admin/(authenticated)/dashboard/page", budgetKb: 200, tier: "feature" },
];

const SLACK_PCT = Number(process.env.BUDGET_SLACK_PCT ?? "5");

function readJson(file) {
	if (!fs.existsSync(file)) return null;
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch {
		return null;
	}
}

function gzippedSize(filePath) {
	if (!fs.existsSync(filePath)) return 0;
	const buf = fs.readFileSync(filePath);
	return zlib.gzipSync(buf).length;
}

function totalKb(bytes) {
	return Math.round((bytes / 1024) * 10) / 10;
}

function main() {
	const json = process.argv.includes("--json");
	if (!fs.existsSync(NEXT_DIR)) {
		console.error("✖ .next/ not found. Run `pnpm build` first.");
		process.exit(1);
	}
	const manifest = readJson(path.join(NEXT_DIR, "app-build-manifest.json"));
	if (!manifest || !manifest.pages || typeof manifest.pages !== "object") {
		console.error("✖ .next/app-build-manifest.json missing or malformed.");
		process.exit(1);
	}

	const results = [];
	for (const budget of BUDGETS) {
		const chunks = manifest.pages[budget.route];
		if (!Array.isArray(chunks)) {
			results.push({
				route: budget.route,
				status: "missing",
				budgetKb: budget.budgetKb,
				actualKb: 0,
				message: "route not in app-build-manifest",
			});
			continue;
		}
		let totalBytes = 0;
		for (const rel of chunks) {
			totalBytes += gzippedSize(path.join(NEXT_DIR, rel));
		}
		const actualKb = totalKb(totalBytes);
		const slackedBudget = budget.budgetKb * (1 + SLACK_PCT / 100);
		const overBudget = actualKb > slackedBudget;
		results.push({
			route: budget.route,
			status: overBudget ? "fail" : "ok",
			budgetKb: budget.budgetKb,
			slackedBudgetKb: Math.round(slackedBudget * 10) / 10,
			actualKb,
			tier: budget.tier,
		});
	}

	if (json) {
		process.stdout.write(JSON.stringify({ slackPct: SLACK_PCT, results }, null, 2) + "\n");
	} else {
		const fmt = (n) => `${n.toFixed(1)} KB`;
		const padR = (s, n) => String(s).padStart(n);
		console.log(`Bundle budget (gzipped first-load JS, slack ±${SLACK_PCT}%)\n`);
		console.log(
			["Route".padEnd(48), padR("Actual", 12), padR("Budget", 12), padR("Slacked", 12), "Status"].join(""),
		);
		for (const r of results) {
			const sym = r.status === "ok" ? "✓" : r.status === "missing" ? "?" : "✗";
			const note = r.status === "missing" ? r.message ?? "" : "";
			console.log(
				[
					r.route.padEnd(48),
					padR(fmt(r.actualKb), 12),
					padR(fmt(r.budgetKb), 12),
					padR(r.slackedBudgetKb ? fmt(r.slackedBudgetKb) : "-", 12),
					` ${sym} ${r.status}${note ? ` (${note})` : ""}`,
				].join(""),
			);
		}
	}

	const failed = results.filter((r) => r.status === "fail");
	const missing = results.filter((r) => r.status === "missing");
	if (failed.length > 0) {
		console.error(`\n✖ ${failed.length} route(s) over budget.`);
		process.exit(1);
	}
	// Missing routes are a soft warning — useful for dev but not a CI block,
	// since the manifest's exact path strings can drift across Next versions.
	if (missing.length > 0 && !process.env.CI) {
		console.warn(`\n? ${missing.length} route(s) not found in manifest (informational only).`);
	}
	console.log("\n✓ All budgets within slack.");
}

main();
