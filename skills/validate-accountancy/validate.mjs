#!/usr/bin/env node
/**
 * validate-accountancy — arithmetic checks on `accountancy_table` specs.
 *
 * Each subKind has its own balance rule (see SKILL.md). Pure JS, no deps.
 */

import { readFileSync } from "node:fs";

function readAllStdin() {
	try {
		return readFileSync(0, "utf8");
	} catch {
		return "";
	}
}

function sumNullable(rows, key) {
	let s = 0;
	for (const r of rows) {
		const v = r?.[key];
		if (typeof v === "number" && Number.isFinite(v)) s += v;
	}
	return s;
}

function checkSpec(spec) {
	switch (spec.subKind) {
		case "journal_entry":
		case "cash_book":
		case "rectification": {
			const debit = sumNullable(spec.rows ?? [], "debit");
			const credit = sumNullable(spec.rows ?? [], "credit");
			return Math.abs(debit - credit) < 0.01
				? { ok: true }
				: {
						ok: false,
						code: "journal_unbalanced",
						details: { debit, credit },
					};
		}
		case "trial_balance": {
			const debit = sumNullable(spec.rows ?? [], "debit");
			const credit = sumNullable(spec.rows ?? [], "credit");
			return Math.abs(debit - credit) < 0.01
				? { ok: true }
				: {
						ok: false,
						code: "trial_balance_unbalanced",
						details: { debit, credit },
					};
		}
		case "balance_sheet": {
			const assets = sumNullable(
				(spec.assetsSide ?? []).filter((r) => !r.bold),
				"amount",
			);
			const eqLiab = sumNullable(
				(spec.equityAndLiabilitiesSide ?? []).filter((r) => !r.bold),
				"amount",
			);
			return Math.abs(assets - eqLiab) < 0.01
				? { ok: true }
				: {
						ok: false,
						code: "balance_sheet_unbalanced",
						details: { assets, eqLiab },
					};
		}
		case "ledger": {
			const ledger = spec.ledger;
			const total =
				(ledger?.debitSide?.length ?? 0) + (ledger?.creditSide?.length ?? 0);
			return total > 0
				? { ok: true }
				: { ok: false, code: "ledger_empty" };
		}
		case "p_and_l": {
			return (spec.rows?.length ?? 0) > 0
				? { ok: true }
				: { ok: false, code: "p_and_l_empty" };
		}
		default:
			return { ok: true };
	}
}

function lint(test) {
	const violations = [];
	const questions = Array.isArray(test?.questions) ? test.questions : [];
	for (let i = 0; i < questions.length; i++) {
		const visual = questions[i]?.visual;
		const spec = visual?.spec;
		if (!spec || spec.kind !== "accountancy_table") continue;
		const r = checkSpec(spec);
		if (!r.ok) violations.push({ index: i, code: r.code, details: r.details });
	}
	return { ok: violations.length === 0, violations };
}

function main() {
	const input = readAllStdin().trim();
	if (input.length === 0) {
		process.stdout.write(JSON.stringify({ ok: false, violations: [{ code: "no_input" }] }));
		process.exit(2);
	}
	let parsed;
	try {
		parsed = JSON.parse(input);
	} catch (e) {
		process.stdout.write(
			JSON.stringify({
				ok: false,
				violations: [{ code: "input_not_json", reason: e instanceof Error ? e.message : "" }],
			}),
		);
		process.exit(2);
	}
	const report = lint(parsed);
	process.stdout.write(JSON.stringify(report));
	process.exit(report.ok ? 0 : 1);
}

main();
