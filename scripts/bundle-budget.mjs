#!/usr/bin/env node
/**
 * Bundle budget gate. Reads `.next/app-build-manifest.json` produced by
 * `next build` (Next ≤15 webpack path), sums the gzipped JS payload per app
 * route, and exits 1 when any route exceeds its budget by more than slack.
 *
 * Next 16 + Turbopack: `app-build-manifest.json` is absent. Per-route
 * first-load chunk lists are not available (per-route `build-manifest.json`
 * files only repeat shared `rootMainFiles`). In that mode the script **skips**
 * per-route totals and instead enforces **VISUAL_CHUNK_BUDGETS** by scanning
 * `.next/static/chunks/*.js` for renderer fingerprints (gzipped size per lib).
 *
 * Usage:
 *   pnpm exec node scripts/bundle-budget.mjs
 *   BUDGET_SLACK_PCT=10 pnpm exec node scripts/bundle-budget.mjs
 *   pnpm exec node scripts/bundle-budget.mjs --json   # machine-readable
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

/**
 * Visual renderer chunks (v2). Each file is assigned to at most one bucket
 * (first matching rule wins). Order matters: list heavier / distinctive libs
 * before broad substring rules.
 *
 * Per-bucket thresholds (gzipped KB):
 */
export const VISUAL_CHUNK_BUDGETS = {
	/** Box-plot path pulls `plotly.js-dist-min`; gzipped payload is large. */
	"plotly.js-dist-min": 1400,
	mermaid: 320,
	mafs: 90,
	"function-plot": 70,
	"smiles-drawer": 60,
};

/** @type {Array<{ key: keyof typeof VISUAL_CHUNK_BUDGETS; test: (s: string) => boolean }>} */
const VISUAL_LIB_RULES = [
	{ key: "plotly.js-dist-min", test: (s) => /plotly/i.test(s) && /Plotly|newPlot/i.test(s) },
	{ key: "mermaid", test: (s) => /\bmermaid\b/i.test(s) },
	{ key: "smiles-drawer", test: (s) => /smiles-drawer|SmilesDrawer/i.test(s) },
	{ key: "function-plot", test: (s) => /function-plot/i.test(s) },
	{ key: "mafs", test: (s) => /mafs/i.test(s) },
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

/**
 * Map legacy `app-build-manifest` page keys to Next.js `app-paths-manifest` keys.
 * @param {string} route
 */
function manifestRouteKey(route) {
	if (route === "/login/page") return "/(auth)/login/page";
	if (route === "/auth/forgot-password/page") return "/(auth)/forgot-password/page";
	return route;
}

/**
 * @returns {Array<{ route: string; status: string; budgetKb: number; actualKb: number; slackedBudgetKb?: number; tier?: string; message?: string }>}
 */
function runLegacyRouteBudgets(manifest) {
	const results = [];
	for (const budget of BUDGETS) {
		const key = manifestRouteKey(budget.route);
		const chunks = manifest.pages[key] ?? manifest.pages[budget.route];
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
	return results;
}

/**
 * @returns {Array<{ key: string; budgetKb: number; actualKb: number; fileCount: number; status: string; slackedBudgetKb: number }>}
 */
function runVisualChunkBudgets() {
	const chunksDir = path.join(NEXT_DIR, "static/chunks");
	/** @type {Record<string, { bytes: number; fileCount: number }>} */
	const sums = {};
	for (const key of Object.keys(VISUAL_CHUNK_BUDGETS)) {
		sums[key] = { bytes: 0, fileCount: 0 };
	}

	if (!fs.existsSync(chunksDir)) {
		return Object.entries(VISUAL_CHUNK_BUDGETS).map(([key, budgetKb]) => ({
			key,
			budgetKb,
			actualKb: 0,
			fileCount: 0,
			slackedBudgetKb: Math.round(budgetKb * (1 + SLACK_PCT / 100) * 10) / 10,
			status: "skipped",
		}));
	}

	for (const name of fs.readdirSync(chunksDir)) {
		if (!name.endsWith(".js")) continue;
		const fp = path.join(chunksDir, name);
		let st;
		try {
			st = fs.statSync(fp);
		} catch {
			continue;
		}
		if (st.size < 400) continue;

		let text;
		try {
			text = fs.readFileSync(fp, "utf8");
		} catch {
			continue;
		}

		for (const rule of VISUAL_LIB_RULES) {
			if (!sums[rule.key]) continue;
			if (rule.test(text)) {
				const bytes = zlib.gzipSync(Buffer.from(text, "utf8")).length;
				sums[rule.key].bytes += bytes;
				sums[rule.key].fileCount++;
				break;
			}
		}
	}

	return Object.entries(VISUAL_CHUNK_BUDGETS).map(([key, budgetKb]) => {
		const { bytes, fileCount } = sums[key];
		const actualKb = totalKb(bytes);
		const slackedBudget = budgetKb * (1 + SLACK_PCT / 100);
		const status = actualKb > slackedBudget ? "fail" : "ok";
		return {
			key,
			budgetKb,
			actualKb,
			fileCount,
			slackedBudgetKb: Math.round(slackedBudget * 10) / 10,
			status,
		};
	});
}

function main() {
	const json = process.argv.includes("--json");
	if (!fs.existsSync(NEXT_DIR)) {
		console.error("✖ .next/ not found. Run `pnpm build` first.");
		process.exit(1);
	}

	const manifestPath = path.join(NEXT_DIR, "app-build-manifest.json");
	const manifest = readJson(manifestPath);
	const legacyOk = Boolean(manifest?.pages && typeof manifest.pages === "object");

	/** @type {Array<{ route: string; status: string; budgetKb: number; actualKb: number; slackedBudgetKb?: number; tier?: string; message?: string }>} */
	let routeResults = [];
	if (legacyOk) {
		routeResults = runLegacyRouteBudgets(manifest);
	} else {
		console.log(
			"⚠  .next/app-build-manifest.json not found (Next 16 / Turbopack). " +
				"Per-route JS budgets skipped — visual-chunk scan runs below.",
		);
	}

	const visualResults = runVisualChunkBudgets();

	if (json) {
		process.stdout.write(
			JSON.stringify(
				{
					slackPct: SLACK_PCT,
					legacyRouteManifest: legacyOk,
					routeResults,
					visualChunkResults: visualResults,
				},
				null,
				2,
			) + "\n",
		);
	} else {
		const fmt = (n) => `${n.toFixed(1)} KB`;
		const padR = (s, n) => String(s).padStart(n);

		if (legacyOk) {
			console.log(`Bundle budget (gzipped first-load JS, slack ±${SLACK_PCT}%)\n`);
			console.log(
				["Route".padEnd(48), padR("Actual", 12), padR("Budget", 12), padR("Slacked", 12), "Status"].join(""),
			);
			for (const r of routeResults) {
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

		console.log(`\nVisual renderer chunks (gzipped, slack ±${SLACK_PCT}%)\n`);
		console.log(
			["Library".padEnd(22), padR("Actual", 12), padR("Budget", 12), padR("Slacked", 12), padR("Files", 8), "Status"].join(
				"",
			),
		);
		for (const v of visualResults) {
			const sym = v.status === "ok" ? "✓" : v.status === "skipped" ? "?" : "✗";
			console.log(
				[
					v.key.padEnd(22),
					padR(fmt(v.actualKb), 12),
					padR(fmt(v.budgetKb), 12),
					padR(fmt(v.slackedBudgetKb), 12),
					padR(String(v.fileCount), 8),
					` ${sym} ${v.status}`,
				].join(""),
			);
		}
	}

	const routeFailed = routeResults.filter((r) => r.status === "fail");
	const routeMissing = routeResults.filter((r) => r.status === "missing");
	const visualFailed = visualResults.filter((v) => v.status === "fail");

	if (routeFailed.length > 0) {
		console.error(`\n✖ ${routeFailed.length} route(s) over budget.`);
		process.exit(1);
	}
	if (visualFailed.length > 0) {
		console.error(`\n✖ ${visualFailed.length} visual renderer chunk bucket(s) over budget.`);
		process.exit(1);
	}
	if (routeMissing.length > 0 && !process.env.CI) {
		console.warn(`\n? ${routeMissing.length} route(s) not found in legacy manifest (informational only).`);
	}

	if (legacyOk) {
		console.log("\n✓ All route budgets within slack.");
	}
	console.log("✓ Visual chunk budgets within slack.");
}

main();
