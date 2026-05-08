#!/usr/bin/env node
/**
 * Read the most recent eval-run JSON from `evals/runs/` and post a summary
 * message to Slack via SLACK_WEBHOOK_URL.
 *
 * Used by .github/workflows/evals-weekly.yml. Also invokable locally:
 *
 *   SLACK_WEBHOOK_URL=https://hooks.slack.com/... node scripts/post-eval-summary-to-slack.mjs
 *
 * Posts a colour-coded message:
 *   - All fixtures pass → green, terse one-liner with totals
 *   - Any regression / schema-invalid → red/yellow, lists each failing fixture
 *
 * Exits 0 even if the post fails, so it never breaks a workflow that
 * already produced useful artifacts.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const RUNS_DIR = path.resolve(process.cwd(), "evals", "runs");

function findLatest() {
	if (!fs.existsSync(RUNS_DIR)) return null;
	const files = fs
		.readdirSync(RUNS_DIR)
		.filter((f) => f.endsWith(".json"))
		.map((f) => path.join(RUNS_DIR, f))
		.sort();
	return files[files.length - 1] ?? null;
}

function fmt(n) {
	if (typeof n !== "number" || Number.isNaN(n)) return "—";
	return n.toLocaleString("en-US");
}

function buildBlocks(run) {
	const s = run.summary;
	const allPass = s.passed === s.totalFixtures && s.failed === 0 && s.schemaInvalid === 0;
	const colour = allPass ? "#36a64f" : s.schemaInvalid > 0 ? "#daa038" : "#d93636";
	const headerEmoji = allPass ? ":white_check_mark:" : ":warning:";
	const filterLabel = run.filter === "all" ? "all subjects" : run.filter;

	const fields = [
		{ title: "Fixtures", value: `${s.passed}/${s.totalFixtures} pass`, short: true },
		{ title: "Assertions", value: `${s.passedAssertions}/${s.totalAssertions} pass`, short: true },
		{ title: "Tokens", value: `in ${fmt(s.totalInputTokens)} / out ${fmt(s.totalOutputTokens)}`, short: true },
		{ title: "Latency", value: `${fmt(s.totalLatencyMs)} ms`, short: true },
		{ title: "Model", value: run.model ?? "(unknown)", short: true },
		{ title: "Run", value: filterLabel, short: true },
	];

	const failures = (run.results ?? []).filter((r) => !r.pass);
	let failuresBlock = "";
	if (failures.length > 0) {
		const lines = failures.slice(0, 10).map((r) => {
			const reasons = (r.outputResults ?? [])
				.filter((a) => !a.pass)
				.slice(0, 2)
				.map((a) => `• ${a.assertion?.type ?? "(unknown)"}: ${a.reason ?? ""}`.trim());
			const err = r.error ? `\n      • error: ${r.error}` : "";
			return `*${r.fixtureId}* (${r.subject})\n      ${reasons.join("\n      ") || "(no per-assertion details)"}${err}`;
		});
		const more = failures.length > 10 ? `\n…and ${failures.length - 10} more` : "";
		failuresBlock = `\n*Failures (${failures.length}):*\n${lines.join("\n\n")}${more}`;
	}

	const runUrl = process.env.GITHUB_RUN_URL;
	const text = `${headerEmoji} *Practice prompt evals* — ${run.generated_at}${runUrl ? ` <${runUrl}|view run>` : ""}${failuresBlock}`;

	return {
		attachments: [
			{
				color: colour,
				text,
				fields,
				mrkdwn_in: ["text", "fields"],
			},
		],
	};
}

async function main() {
	const webhook = process.env.SLACK_WEBHOOK_URL;
	if (!webhook) {
		process.stdout.write("SLACK_WEBHOOK_URL not set; skipping Slack post.\n");
		process.exit(0);
	}

	const file = findLatest();
	if (!file) {
		process.stdout.write("No eval-run JSON files found in evals/runs/; nothing to post.\n");
		process.exit(0);
	}

	const run = JSON.parse(fs.readFileSync(file, "utf8"));
	if (run.schema_version !== 1) {
		process.stderr.write(`Unsupported eval-run schema_version=${run.schema_version}; skipping.\n`);
		process.exit(0);
	}

	const payload = buildBlocks(run);

	try {
		const res = await fetch(webhook, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (!res.ok) {
			const body = await res.text();
			process.stderr.write(`Slack webhook returned ${res.status}: ${body.slice(0, 300)}\n`);
		} else {
			process.stdout.write(`Posted Slack summary for ${path.basename(file)}.\n`);
		}
	} catch (e) {
		process.stderr.write(`Slack post failed: ${e instanceof Error ? e.message : String(e)}\n`);
	}

	process.exit(0);
}

main();
