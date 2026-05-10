#!/usr/bin/env node
/**
 * validate-smiles — pure-Node SMILES syntax validator.
 *
 * v1 covers character-class and bracket-balance checks. A full parse
 * (RDKit or smiles-drawer) is deferred until the OpenAI Skills runtime
 * is pinned and we know which deps it can install. See SKILL.md.
 */

import { readFileSync } from "node:fs";

const SMILES_ALPHABET = /^[A-Za-z0-9@.+\-?!()\[\]{}/\\=#$:*]+$/;

function readAllStdin() {
	try {
		return readFileSync(0, "utf8");
	} catch {
		return "";
	}
}

function bracketsBalanced(smiles) {
	const stack = [];
	const open = { "(": ")", "[": "]" };
	for (const ch of smiles) {
		if (ch in open) {
			stack.push(open[ch]);
		} else if (ch === ")" || ch === "]") {
			if (stack.pop() !== ch) return false;
		}
	}
	return stack.length === 0;
}

function checkSmiles(smiles) {
	if (typeof smiles !== "string" || smiles.trim().length === 0) {
		return { ok: false, code: "smiles_empty", reason: "empty" };
	}
	if (!SMILES_ALPHABET.test(smiles)) {
		return { ok: false, code: "smiles_invalid", reason: "char_outside_alphabet" };
	}
	if (!bracketsBalanced(smiles)) {
		return { ok: false, code: "smiles_invalid", reason: "unbalanced_brackets" };
	}
	return { ok: true };
}

function lint(test) {
	const violations = [];
	const questions = Array.isArray(test?.questions) ? test.questions : [];
	for (let i = 0; i < questions.length; i++) {
		const visual = questions[i]?.visual;
		const spec = visual?.spec;
		if (!spec || spec.kind !== "chemistry_molecule") continue;
		const r = checkSmiles(spec.smiles);
		if (!r.ok) {
			violations.push({ index: i, code: r.code, reason: r.reason });
		}
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
