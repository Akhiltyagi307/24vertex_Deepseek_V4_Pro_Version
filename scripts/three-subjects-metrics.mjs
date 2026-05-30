#!/usr/bin/env node
/**
 * One-shot reporter for the three-subject Playwright run.
 *
 * Reads `playwright-report/three-subjects-runs.json` (produced by
 * `tests/e2e/student-practice-three-subjects.spec.ts`) and queries Supabase
 * for per-test metrics:
 *   - wall time (from spec timings + DB run timings)
 *   - input + output tokens (practice_generation_runs + ai_calls)
 *   - visuals generated (questions.metadata->>'visual' not null + visual_enrichment ai_calls)
 *   - cost in INR (sum of ai_calls.cost_inr scoped to test_id)
 *
 * Prints a markdown summary table. No DB writes.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import "dotenv/config";

const SB = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
if (!SB || !KEY) {
	console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
	process.exit(1);
}

const ARTIFACT = path.resolve("playwright-report/three-subjects-runs.json");
if (!existsSync(ARTIFACT)) {
	console.error(`Artifact missing: ${ARTIFACT}`);
	process.exit(1);
}
const runs = JSON.parse(readFileSync(ARTIFACT, "utf-8"));
if (!Array.isArray(runs) || runs.length === 0) {
	console.error("Artifact is empty.");
	process.exit(1);
}

const H = () => ({ apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: "application/json" });

async function rest(pathAndQs) {
	const r = await fetch(`${SB}/rest/v1/${pathAndQs}`, { headers: H() });
	if (!r.ok) {
		const t = await r.text();
		throw new Error(`REST ${pathAndQs} ${r.status}: ${t.slice(0, 400)}`);
	}
	return r.json();
}

function fmtInr(n) {
	if (n == null || !Number.isFinite(n)) return "—";
	return `₹${n.toFixed(4)}`;
}
function fmtSec(n) {
	if (n == null || !Number.isFinite(n)) return "—";
	return `${n.toFixed(1)}s`;
}
function fmtTokens(n) {
	if (n == null || !Number.isFinite(n)) return "—";
	return n.toLocaleString("en-IN");
}

async function fetchMetricsForTest(testId) {
	const runRows = await rest(
		`practice_generation_runs?test_id=eq.${testId}&select=id,correlation_id,status,failure_code,total_input_tokens,total_output_tokens,total_ai_calls,timings_ms,started_at,finished_at`,
	);
	const run = Array.isArray(runRows) && runRows[0] ? runRows[0] : null;
	const stepRows = run
		? await rest(
				`practice_generation_steps?run_id=eq.${run.id}&select=step_key,feature,model,status,input_tokens,output_tokens,latency_ms,metadata&order=step_order.asc&limit=200`,
		  )
		: [];
	const aiCalls = await rest(
		`ai_calls?test_id=eq.${testId}&select=feature,step_key,model,input_tokens,output_tokens,reasoning_tokens,cost_inr,status,latency_ms&limit=2000`,
	);
	const questions = await rest(
		`questions?test_id=eq.${testId}&select=id,question_number,metadata&limit=500`,
	);

	const visualEnrichmentCalls = aiCalls.filter((c) =>
		(c.feature ?? "").includes("visual_enrichment"),
	);
	const questionsWithVisual = questions.filter((q) => {
		const m = q?.metadata;
		if (!m || typeof m !== "object") return false;
		return m.visual != null;
	});

	const sum = (rows, key) => rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);
	const aiInputTokens = sum(aiCalls, "input_tokens");
	const aiOutputTokens = sum(aiCalls, "output_tokens");
	const aiCostInr = aiCalls.reduce((a, r) => a + (Number(r.cost_inr) || 0), 0);
	const visualCostInr = visualEnrichmentCalls.reduce(
		(a, r) => a + (Number(r.cost_inr) || 0),
		0,
	);
	const visualInputTokens = sum(visualEnrichmentCalls, "input_tokens");
	const visualOutputTokens = sum(visualEnrichmentCalls, "output_tokens");

	// DB-side wall time (covers regen retries; spec wall covers UI too).
	let dbWallSec = null;
	if (run?.started_at && run?.finished_at) {
		dbWallSec = (new Date(run.finished_at) - new Date(run.started_at)) / 1000;
	}

	return {
		run,
		stepRows,
		aiCalls,
		questions,
		visualEnrichmentCalls,
		questionsWithVisual,
		aiInputTokens,
		aiOutputTokens,
		aiCostInr,
		visualInputTokens,
		visualOutputTokens,
		visualCostInr,
		dbWallSec,
	};
}

async function main() {
	const results = [];
	for (const run of runs) {
		const m = await fetchMetricsForTest(run.test_id);
		results.push({ spec: run, m });
	}

	// --- per-subject breakdown ---
	console.log("\n# Three-subject practice run — metrics report\n");
	console.log(`Generated: ${new Date().toISOString()}`);
	console.log(`Source artifact: ${ARTIFACT}\n`);

	console.log("## Per-subject summary\n");
	console.log(
		"| Subject | test_id | Wall (UI) | Generation | Grading wait | Total tokens in | Total tokens out | AI calls | Questions | With visual | Cost (INR) |",
	);
	console.log(
		"|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
	);
	let totals = {
		wall: 0,
		gen: 0,
		grading: 0,
		input: 0,
		output: 0,
		calls: 0,
		questions: 0,
		visuals: 0,
		cost: 0,
	};
	for (const { spec, m } of results) {
		const wall = spec.wall_seconds;
		const gen = spec.generation_seconds;
		const grading = spec.grading_wait_seconds;
		const inTok = m.aiInputTokens;
		const outTok = m.aiOutputTokens;
		const calls = m.aiCalls.length;
		const qs = m.questions.length;
		const visuals = m.questionsWithVisual.length;
		const cost = m.aiCostInr;
		totals.wall += wall;
		totals.gen += gen;
		totals.grading += grading;
		totals.input += inTok;
		totals.output += outTok;
		totals.calls += calls;
		totals.questions += qs;
		totals.visuals += visuals;
		totals.cost += cost;
		console.log(
			`| ${spec.subject_name} | \`${spec.test_id}\` | ${fmtSec(wall)} | ${fmtSec(gen)} | ${fmtSec(grading)} | ${fmtTokens(inTok)} | ${fmtTokens(outTok)} | ${calls} | ${qs} | ${visuals} | ${fmtInr(cost)} |`,
		);
	}
	console.log(
		`| **TOTAL** | — | ${fmtSec(totals.wall)} | ${fmtSec(totals.gen)} | ${fmtSec(totals.grading)} | ${fmtTokens(totals.input)} | ${fmtTokens(totals.output)} | ${totals.calls} | ${totals.questions} | ${totals.visuals} | ${fmtInr(totals.cost)} |`,
	);

	console.log("\n## Visual-enrichment breakdown\n");
	console.log(
		"| Subject | Visual AI calls | Visual tokens in | Visual tokens out | Visual cost (INR) | Questions w/ visual | Visual rate |",
	);
	console.log("|---|---:|---:|---:|---:|---:|---:|");
	let vTot = { calls: 0, in: 0, out: 0, cost: 0, q: 0, hasV: 0 };
	for (const { spec, m } of results) {
		const calls = m.visualEnrichmentCalls.length;
		const inTok = m.visualInputTokens;
		const outTok = m.visualOutputTokens;
		const cost = m.visualCostInr;
		const total = m.questions.length;
		const visuals = m.questionsWithVisual.length;
		const rate = total > 0 ? `${((visuals / total) * 100).toFixed(0)}%` : "—";
		vTot.calls += calls;
		vTot.in += inTok;
		vTot.out += outTok;
		vTot.cost += cost;
		vTot.q += total;
		vTot.hasV += visuals;
		console.log(
			`| ${spec.subject_name} | ${calls} | ${fmtTokens(inTok)} | ${fmtTokens(outTok)} | ${fmtInr(cost)} | ${visuals}/${total} | ${rate} |`,
		);
	}
	const vRate = vTot.q > 0 ? `${((vTot.hasV / vTot.q) * 100).toFixed(0)}%` : "—";
	console.log(
		`| **TOTAL** | ${vTot.calls} | ${fmtTokens(vTot.in)} | ${fmtTokens(vTot.out)} | ${fmtInr(vTot.cost)} | ${vTot.hasV}/${vTot.q} | ${vRate} |`,
	);

	console.log("\n## Per-subject step latencies (DB-side)\n");
	for (const { spec, m } of results) {
		console.log(`### ${spec.subject_name} (test_id ${spec.test_id})`);
		if (!m.run) {
			console.log("- No `practice_generation_runs` row found.\n");
			continue;
		}
		console.log(
			`- correlation_id: \`${m.run.correlation_id}\` · status: ${m.run.status}${
				m.run.failure_code ? ` · failure: ${m.run.failure_code}` : ""
			}`,
		);
		console.log(
			`- total_input_tokens (run agg): ${fmtTokens(Number(m.run.total_input_tokens))}, total_output_tokens: ${fmtTokens(Number(m.run.total_output_tokens))}, total_ai_calls: ${m.run.total_ai_calls}`,
		);
		console.log(
			`- DB wall: ${fmtSec(m.dbWallSec)} (started ${m.run.started_at}, finished ${m.run.finished_at})`,
		);
		console.log("\n| Step | Model | Status | Latency | In | Out |");
		console.log("|---|---|---|---:|---:|---:|");
		for (const s of m.stepRows) {
			console.log(
				`| ${s.step_key} | ${s.model ?? "—"} | ${s.status} | ${fmtSec((Number(s.latency_ms) || 0) / 1000)} | ${fmtTokens(Number(s.input_tokens) || 0)} | ${fmtTokens(Number(s.output_tokens) || 0)} |`,
			);
		}
		console.log("");
		// AI-calls feature breakdown (top features)
		const byFeature = new Map();
		for (const c of m.aiCalls) {
			const key = c.feature ?? "—";
			const v = byFeature.get(key) ?? { n: 0, in: 0, out: 0, cost: 0 };
			v.n += 1;
			v.in += Number(c.input_tokens) || 0;
			v.out += Number(c.output_tokens) || 0;
			v.cost += Number(c.cost_inr) || 0;
			byFeature.set(key, v);
		}
		console.log("| Feature | Calls | Tokens in | Tokens out | Cost (INR) |");
		console.log("|---|---:|---:|---:|---:|");
		for (const [k, v] of [...byFeature.entries()].sort((a, b) => b[1].cost - a[1].cost)) {
			console.log(`| ${k} | ${v.n} | ${fmtTokens(v.in)} | ${fmtTokens(v.out)} | ${fmtInr(v.cost)} |`);
		}
		console.log("");
	}

	console.log("---");
	console.log(
		`Pricing: ai_calls.cost_inr is computed at call time per src/lib/ai/model-pricing.ts using AI_COST_USD_TO_INR (default 83). Totals reflect what would have been billed at then-current rates.`,
	);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
