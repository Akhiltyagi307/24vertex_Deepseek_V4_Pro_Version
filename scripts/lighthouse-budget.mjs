#!/usr/bin/env node
/**
 * Lighthouse score gate. Reads JSON reports produced by `lighthouse --output=json`
 * for the public landing and the privacy legal page, and exits 1 when any
 * category score falls below threshold.
 *
 * The thresholds are deliberately conservative — Lighthouse scoring has run-to-
 * run variance (especially Performance) so we'd rather tolerate small dips than
 * gate PRs on transient noise. Tighten over time once we have a feel for the
 * actual ceiling.
 *
 * Usage (CI):
 *   lighthouse http://localhost:3000/ --output=json --output-path=lighthouse-landing.json [...]
 *   lighthouse http://localhost:3000/legal/privacy --output=json --output-path=lighthouse-legal-privacy.json [...]
 *   node scripts/lighthouse-budget.mjs
 */
import fs from "node:fs";
import path from "node:path";

/**
 * Floors, not targets. Lighthouse on ubuntu-latest runners has significant
 * run-to-run variance — especially for Performance — so the gates here are
 * "what we will not regress past", not "what we want to achieve". Production
 * Vercel deploys typically score 15-20 points higher than CI for Perf.
 * Tighten over time once we have a stable baseline distribution.
 *
 * @type {Array<{ file: string; label: string; thresholds: { performance: number; accessibility: number; "best-practices": number; seo: number } }>}
 */
const REPORTS = [
	{
		file: "lighthouse-landing.json",
		label: "/",
		thresholds: { performance: 0.7, accessibility: 0.9, "best-practices": 0.8, seo: 0.9 },
	},
	{
		file: "lighthouse-legal-privacy.json",
		label: "/legal/privacy",
		thresholds: { performance: 0.8, accessibility: 0.9, "best-practices": 0.8, seo: 0.9 },
	},
];

let failed = 0;

for (const report of REPORTS) {
	const fp = path.resolve(report.file);
	if (!fs.existsSync(fp)) {
		console.error(`✖ Report not found: ${report.file}`);
		failed++;
		continue;
	}

	let data;
	try {
		data = JSON.parse(fs.readFileSync(fp, "utf8"));
	} catch (err) {
		console.error(`✖ Failed to parse ${report.file}: ${err.message}`);
		failed++;
		continue;
	}

	const categories = data.categories ?? {};
	console.log(`\nLighthouse — ${report.label}`);
	for (const [key, minScore] of Object.entries(report.thresholds)) {
		const actual = categories[key]?.score;
		if (typeof actual !== "number") {
			console.error(`  ✖ ${key}: score missing`);
			failed++;
			continue;
		}
		const sym = actual >= minScore ? "✓" : "✗";
		const formatted = `${Math.round(actual * 100)}/100`;
		const target = `≥ ${Math.round(minScore * 100)}`;
		console.log(`  ${sym} ${key.padEnd(16)} ${formatted.padEnd(8)} (target ${target})`);
		if (actual < minScore) failed++;
	}
}

if (failed > 0) {
	console.error(`\n✖ ${failed} Lighthouse threshold(s) missed.`);
	process.exit(1);
}
console.log("\n✓ All Lighthouse thresholds met.");
