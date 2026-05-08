#!/usr/bin/env node
/**
 * Diff two practice eval-run JSON files and print a colorised summary of
 * regressions / improvements.
 *
 * Usage:
 *   node scripts/diff-eval-runs.mjs                                # latest two
 *   node scripts/diff-eval-runs.mjs <old.json> <new.json>          # specific pair
 *
 * Exit codes:
 *   0 — no regressions (newer run passes ≥ as many fixtures/assertions as older)
 *   1 — regressions detected
 *   2 — usage / I/O error
 */

import * as fs from "node:fs";
import * as path from "node:path";

const RUNS_DIR = path.resolve(process.cwd(), "evals", "runs");

const colour = process.stdout.isTTY
	? {
		red: (s) => `\x1b[31m${s}\x1b[0m`,
		green: (s) => `\x1b[32m${s}\x1b[0m`,
		yellow: (s) => `\x1b[33m${s}\x1b[0m`,
		grey: (s) => `\x1b[90m${s}\x1b[0m`,
		bold: (s) => `\x1b[1m${s}\x1b[0m`,
	}
	: { red: (s) => s, green: (s) => s, yellow: (s) => s, grey: (s) => s, bold: (s) => s };

function findLatestTwo() {
	if (!fs.existsSync(RUNS_DIR)) {
		throw new Error(
			`No evals/runs directory at ${RUNS_DIR}. Run \`pnpm run evals:practice -- --json\` first.`,
		);
	}
	const files = fs
		.readdirSync(RUNS_DIR)
		.filter((f) => f.endsWith(".json"))
		.map((f) => path.join(RUNS_DIR, f))
		.sort();
	if (files.length < 2) {
		throw new Error(
			`Need ≥ 2 run files in ${RUNS_DIR} to diff; found ${files.length}.`,
		);
	}
	return [files[files.length - 2], files[files.length - 1]];
}

function loadRun(file) {
	const raw = fs.readFileSync(file, "utf8");
	const parsed = JSON.parse(raw);
	if (parsed.schema_version !== 1) {
		throw new Error(
			`${file}: unsupported eval-run schema_version=${parsed.schema_version}; expected 1`,
		);
	}
	return parsed;
}

function indexById(run) {
	return new Map(run.results.map((r) => [r.fixtureId, r]));
}

function fmtDelta(a, b) {
	const d = b - a;
	if (d === 0) return colour.grey(`±0`);
	if (d > 0) return colour.green(`+${d}`);
	return colour.red(`${d}`);
}

function fmtPct(a, total) {
	if (total === 0) return "—";
	return `${((a / total) * 100).toFixed(1)}%`;
}

function main() {
	const argv = process.argv.slice(2);
	let oldFile;
	let newFile;
	if (argv.length === 0) {
		[oldFile, newFile] = findLatestTwo();
	} else if (argv.length === 2) {
		oldFile = path.resolve(argv[0]);
		newFile = path.resolve(argv[1]);
	} else {
		process.stderr.write(
			`Usage: node scripts/diff-eval-runs.mjs [<old.json> <new.json>]\n`,
		);
		process.exit(2);
	}

	const oldRun = loadRun(oldFile);
	const newRun = loadRun(newFile);

	process.stdout.write(colour.bold(`Diff:\n`));
	process.stdout.write(`  old:  ${path.basename(oldFile)}  (${oldRun.generated_at}, model=${oldRun.model})\n`);
	process.stdout.write(`  new:  ${path.basename(newFile)}  (${newRun.generated_at}, model=${newRun.model})\n\n`);

	// Top-line summary
	const oS = oldRun.summary;
	const nS = newRun.summary;
	process.stdout.write(colour.bold(`Summary:\n`));
	process.stdout.write(
		`  Fixtures pass:   ${oS.passed}/${oS.totalFixtures} (${fmtPct(oS.passed, oS.totalFixtures)})  →  ${nS.passed}/${nS.totalFixtures} (${fmtPct(nS.passed, nS.totalFixtures)})  ${fmtDelta(oS.passed, nS.passed)}\n`,
	);
	process.stdout.write(
		`  Assertions pass: ${oS.passedAssertions}/${oS.totalAssertions}  →  ${nS.passedAssertions}/${nS.totalAssertions}  ${fmtDelta(oS.passedAssertions, nS.passedAssertions)}\n`,
	);
	process.stdout.write(
		`  Tokens (in/out): ${oS.totalInputTokens.toLocaleString()}/${oS.totalOutputTokens.toLocaleString()}  →  ${nS.totalInputTokens.toLocaleString()}/${nS.totalOutputTokens.toLocaleString()}\n`,
	);
	process.stdout.write(
		`  Latency:         ${oS.totalLatencyMs.toLocaleString()}ms  →  ${nS.totalLatencyMs.toLocaleString()}ms  (${fmtDelta(oS.totalLatencyMs, nS.totalLatencyMs)} ms)\n\n`,
	);

	const oIdx = indexById(oldRun);
	const nIdx = indexById(newRun);

	const allIds = new Set([...oIdx.keys(), ...nIdx.keys()]);
	const regressed = [];
	const improved = [];
	const newOnly = [];
	const removed = [];

	for (const id of allIds) {
		const o = oIdx.get(id);
		const n = nIdx.get(id);
		if (!o) {
			newOnly.push(n);
			continue;
		}
		if (!n) {
			removed.push(o);
			continue;
		}
		if (o.pass && !n.pass) regressed.push({ id, old: o, new: n });
		else if (!o.pass && n.pass) improved.push({ id, old: o, new: n });
	}

	if (regressed.length > 0) {
		process.stdout.write(colour.bold(colour.red(`Regressions (${regressed.length}):\n`)));
		for (const r of regressed) {
			process.stdout.write(`  ${colour.red("✗")} ${r.id}  [${r.new.subject}]\n`);
			const failedAssertions = (r.new.outputResults ?? []).filter((a) => !a.pass);
			for (const a of failedAssertions.slice(0, 3)) {
				process.stdout.write(`      • ${a.assertion?.type ?? "(unknown)"}: ${a.reason ?? "(no reason)"}\n`);
			}
			if (failedAssertions.length > 3) {
				process.stdout.write(`      • …and ${failedAssertions.length - 3} more failure(s).\n`);
			}
			if (r.new.error) process.stdout.write(`      • error: ${r.new.error}\n`);
		}
		process.stdout.write("\n");
	}

	if (improved.length > 0) {
		process.stdout.write(colour.bold(colour.green(`Improvements (${improved.length}):\n`)));
		for (const i of improved) {
			process.stdout.write(`  ${colour.green("✓")} ${i.id}  [${i.new.subject}]\n`);
		}
		process.stdout.write("\n");
	}

	if (newOnly.length > 0) {
		process.stdout.write(colour.bold(colour.yellow(`New fixtures in newer run (${newOnly.length}):\n`)));
		for (const n of newOnly) {
			process.stdout.write(`  ${colour.yellow("+")} ${n.fixtureId}  [${n.subject}]  ${n.pass ? "PASS" : "FAIL"}\n`);
		}
		process.stdout.write("\n");
	}

	if (removed.length > 0) {
		process.stdout.write(colour.bold(colour.grey(`Fixtures removed since old run (${removed.length}):\n`)));
		for (const r of removed) {
			process.stdout.write(`  ${colour.grey("−")} ${r.fixtureId}  [${r.subject}]\n`);
		}
		process.stdout.write("\n");
	}

	if (regressed.length === 0 && improved.length === 0) {
		process.stdout.write(colour.grey(`No fixture-level pass/fail changes between runs.\n`));
	}

	process.exit(regressed.length > 0 ? 1 : 0);
}

try {
	main();
} catch (e) {
	process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
	process.exit(2);
}
