#!/usr/bin/env node
/**
 * ncert-chemistry-conventions linter.
 *
 * Reads a test JSON on stdin, walks every chemistry_molecule and
 * chemistry_reaction visual, flags conventions violations. RDKit-style
 * SMILES parse validation is left to the `validate-smiles` skill so this
 * file stays Node-only and zero-dep.
 *
 * Output: { ok: boolean, violations: [{ index, code, message }] }.
 */

import { readFileSync } from "node:fs";

const STDIN_FD = 0;

function readAllStdin() {
	try {
		return readFileSync(STDIN_FD, "utf8");
	} catch {
		return "";
	}
}

function lint(test) {
	const violations = [];
	const questions = Array.isArray(test?.questions) ? test.questions : [];
	for (let i = 0; i < questions.length; i++) {
		const q = questions[i];
		const visual = q?.visual;
		if (visual == null) continue;
		const spec = visual.spec;
		if (!spec || typeof spec !== "object") continue;
		if (spec.kind === "chemistry_molecule") {
			violations.push(...checkMolecule(i, spec));
		} else if (spec.kind === "chemistry_reaction") {
			violations.push(...checkReaction(i, spec));
		}
	}
	return { ok: violations.length === 0, violations };
}

function checkMolecule(index, spec) {
	const out = [];
	if (typeof spec.smiles !== "string" || spec.smiles.trim().length === 0) {
		out.push({
			index,
			code: "chemistry_molecule.smiles_empty",
			message: "SMILES string is empty",
		});
	}
	return out;
}

function checkReaction(index, spec) {
	const out = [];
	const ce = typeof spec.ce === "string" ? spec.ce : "";
	if (ce.trim().length === 0) {
		out.push({
			index,
			code: "chemistry_reaction.ce_empty",
			message: "mhchem ce string is empty",
		});
		return out;
	}
	if (/[A-Z][a-z]?_[0-9]/.test(ce)) {
		out.push({
			index,
			code: "chemistry_reaction.ce_underscore_subscript",
			message: "Reaction uses underscore-subscript (H_2O); mhchem auto-subscripts numbers — write H2O instead",
		});
	}
	// Single backslash followed by a letter is a TeX control sequence; mhchem
	// (used inside KaTeX) requires it doubled in JSON strings (\\Delta).
	if (/(?:^|[^\\])\\[A-Za-z]/.test(ce)) {
		out.push({
			index,
			code: "chemistry_reaction.ce_single_backslash",
			message: "Reaction uses single-backslash control sequence; mhchem expects double-backslash (\\\\Delta)",
		});
	}
	return out;
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
				violations: [{ code: "input_not_json", message: e instanceof Error ? e.message : "" }],
			}),
		);
		process.exit(2);
	}
	const report = lint(parsed);
	process.stdout.write(JSON.stringify(report));
	process.exit(report.ok ? 0 : 1);
}

main();
