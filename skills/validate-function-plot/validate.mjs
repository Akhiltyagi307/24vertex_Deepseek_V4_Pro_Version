#!/usr/bin/env node
/**
 * validate-function-plot — pure-Node syntax validator for the math/economics
 * curve expression strings. Eval-based finite-range check is a roadmap item;
 * v1 ships syntax-only.
 */

import { readFileSync } from "node:fs";

const EXPR_ALPHABET = /^[A-Za-z0-9 +\-*/^()._,]+$/;

function readAllStdin() {
	try {
		return readFileSync(0, "utf8");
	} catch {
		return "";
	}
}

function bracketsBalanced(s) {
	let depth = 0;
	for (const ch of s) {
		if (ch === "(") depth++;
		else if (ch === ")") {
			if (--depth < 0) return false;
		}
	}
	return depth === 0;
}

function checkExpr(expr) {
	if (typeof expr !== "string" || expr.trim().length === 0) {
		return { ok: false, code: "expr_invalid", reason: "empty" };
	}
	if (!EXPR_ALPHABET.test(expr)) {
		return { ok: false, code: "expr_invalid", reason: "char_outside_alphabet" };
	}
	if (!bracketsBalanced(expr)) {
		return { ok: false, code: "expr_invalid", reason: "unbalanced_parens" };
	}
	return { ok: true };
}

function lint(test) {
	const violations = [];
	const questions = Array.isArray(test?.questions) ? test.questions : [];
	for (let i = 0; i < questions.length; i++) {
		const visual = questions[i]?.visual;
		const spec = visual?.spec;
		if (!spec) continue;
		if (spec.kind === "math_function_plot") {
			for (const item of spec.items ?? []) {
				const r = checkExpr(item?.expr);
				if (!r.ok) violations.push({ index: i, code: r.code, reason: r.reason });
			}
		} else if (spec.kind === "economics_curve") {
			for (const curve of spec.curves ?? []) {
				const r = checkExpr(curve?.expr);
				if (!r.ok) violations.push({ index: i, code: r.code, reason: r.reason });
			}
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
