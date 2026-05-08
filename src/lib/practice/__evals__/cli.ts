/**
 * CLI entry point for the practice prompt eval runner.
 *
 * Usage:
 *   tsx --env-file=.env.local src/lib/practice/__evals__/cli.ts                  # all fixtures
 *   tsx --env-file=.env.local src/lib/practice/__evals__/cli.ts physics-11-12    # one subject
 *   tsx --env-file=.env.local src/lib/practice/__evals__/cli.ts math-6-10-grade-8-medium-12q  # one fixture
 *
 * Flags (parsed loosely from argv after the optional filter):
 *   --json                     write a JSON results file to evals/runs/<timestamp>.json
 *   --json-only                same as --json but suppress the formatted stdout report
 *   --no-summary               don't print the per-subject summary block
 *
 * Or via package.json: `pnpm run evals:practice -- physics-11-12 --json`.
 *
 * Exits with code 0 when all fixtures pass, 1 otherwise. Cost-bearing — each
 * fixture is one LLM call against `OPENAI_CHAT_MODEL`.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { FIXTURES, FIXTURES_BY_SUBJECT } from "../__fixtures__/index";
import type { PracticeFixture } from "../__fixtures__/types";
import { buildPracticeSystemPrompt } from "../system-prompt";
import {
	runEvalSet,
	type EvalRunSummary,
	type FixtureEvalResult,
} from "./runner";

function pickFixtures(filter: string | undefined): PracticeFixture[] {
	if (!filter) return FIXTURES;
	if (FIXTURES_BY_SUBJECT[filter]) return FIXTURES_BY_SUBJECT[filter];
	const byId = FIXTURES.find((f) => f.id === filter);
	if (byId) return [byId];
	const matchPrefix = FIXTURES.filter((f) => f.id.startsWith(filter));
	if (matchPrefix.length > 0) return matchPrefix;
	return [];
}

function fmt(n: number): string {
	return n.toLocaleString("en-US");
}

function symbol(pass: boolean): string {
	return pass ? "✓" : "✗";
}

function printResult(r: FixtureEvalResult): void {
	const status = r.pass ? "PASS" : r.schemaValid ? "FAIL" : "INVALID";
	const head = `${symbol(r.pass)} [${status}] ${r.fixtureId}  (${r.latencyMs}ms; in=${fmt(r.usage.inputTokens)} out=${fmt(r.usage.outputTokens)} tokens)`;
	process.stdout.write(`${head}\n`);
	if (r.error) {
		process.stdout.write(`    error: ${r.error}\n`);
	}
	for (const a of r.outputResults) {
		const line = `    ${symbol(a.pass)} ${a.assertion.type}${a.reason ? ` — ${a.reason}` : ""}`;
		process.stdout.write(`${line}\n`);
	}
}

type ParsedArgs = {
	filter: string | undefined;
	writeJson: boolean;
	jsonOnly: boolean;
	noSummary: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
	const flagSet = new Set(argv.filter((a) => a.startsWith("--")));
	const positional = argv.filter((a) => !a.startsWith("--"));
	return {
		filter: positional[0],
		writeJson: flagSet.has("--json") || flagSet.has("--json-only"),
		jsonOnly: flagSet.has("--json-only"),
		noSummary: flagSet.has("--no-summary"),
	};
}

/**
 * Persist a run as a JSON file under `evals/runs/<timestamp>-<filter>.json`.
 * Returns the absolute path so the caller can echo it.
 */
function writeJsonResults(
	summary: EvalRunSummary,
	filter: string | undefined,
	model: string,
): string {
	const repoRoot = process.cwd();
	const dir = path.join(repoRoot, "evals", "runs");
	fs.mkdirSync(dir, { recursive: true });
	const ts = new Date().toISOString().replace(/[:.]/g, "-");
	const filterSlug = filter ? `--${filter.replace(/[^a-z0-9-]/gi, "_")}` : "--all";
	const file = path.join(dir, `${ts}${filterSlug}.json`);
	const payload = {
		schema_version: 1,
		generated_at: new Date().toISOString(),
		filter: filter ?? "all",
		model,
		summary: {
			totalFixtures: summary.totalFixtures,
			passed: summary.passed,
			failed: summary.failed,
			schemaInvalid: summary.schemaInvalid,
			totalAssertions: summary.totalAssertions,
			passedAssertions: summary.passedAssertions,
			totalInputTokens: summary.totalInputTokens,
			totalOutputTokens: summary.totalOutputTokens,
			totalLatencyMs: summary.totalLatencyMs,
		},
		results: summary.results,
	};
	fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
	return file;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const fixtures = pickFixtures(args.filter);

	if (fixtures.length === 0) {
		process.stderr.write(
			`No fixtures matched ${JSON.stringify(args.filter)}.\n` +
				`Available subjects: ${Object.keys(FIXTURES_BY_SUBJECT).join(", ")}\n` +
				`Available ids: ${FIXTURES.map((f) => f.id).join(", ")}\n`,
		);
		process.exit(2);
	}

	const log = (s: string) => {
		if (!args.jsonOnly) process.stdout.write(s);
	};

	log(`Running ${fixtures.length} fixture(s)…\n\n`);

	let modelUsed = "(unknown)";

	const summary = await runEvalSet(fixtures, {
		buildSystemPrompt: (fixture) =>
			buildPracticeSystemPrompt({
				userMessageSummary: fixture.input.userMessageSummary,
				generationSubject: fixture.input.generationSubject,
			}),
		onResult: (r) => {
			if (!args.jsonOnly) printResult(r);
		},
		onModelResolved: (m) => {
			modelUsed = m;
		},
	});

	log(`\nSummary:\n`);
	log(
		`  Fixtures:    ${summary.passed}/${summary.totalFixtures} pass${summary.schemaInvalid > 0 ? `  (${summary.schemaInvalid} schema-invalid)` : ""}\n`,
	);
	log(`  Assertions:  ${summary.passedAssertions}/${summary.totalAssertions} pass\n`);
	log(`  Tokens:      input=${fmt(summary.totalInputTokens)}, output=${fmt(summary.totalOutputTokens)}\n`);
	log(`  Latency:     ${fmt(summary.totalLatencyMs)}ms total\n`);

	// Per-subject breakdown when running multiple
	if (summary.totalFixtures > 1 && !args.noSummary) {
		log(`\nBy subject:\n`);
		const bySubject = summary.results.reduce(
			(acc, r) => {
				(acc[r.subject] ??= { pass: 0, fail: 0 });
				if (r.pass) acc[r.subject].pass++;
				else acc[r.subject].fail++;
				return acc;
			},
			{} as Record<string, { pass: number; fail: number }>,
		);
		for (const [subject, counts] of Object.entries(bySubject).sort(([a], [b]) =>
			a.localeCompare(b),
		)) {
			const total = counts.pass + counts.fail;
			log(`  ${subject.padEnd(28)} ${counts.pass}/${total}\n`);
		}
	}

	if (args.writeJson) {
		const file = writeJsonResults(summary, args.filter, modelUsed);
		log(`\nWrote ${file}\n`);
		if (args.jsonOnly) process.stdout.write(`${file}\n`);
	}

	process.exit(summary.failed === 0 ? 0 : 1);
}

main().catch((e) => {
	process.stderr.write(`Eval runner failed: ${e instanceof Error ? e.message : String(e)}\n`);
	process.exit(2);
});
