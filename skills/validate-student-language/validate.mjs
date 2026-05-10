#!/usr/bin/env node
/**
 * validate-student-language — heuristic checks for stems, explanations,
 * common-mistakes entries, and related-concept references.
 */

import { readFileSync } from "node:fs";

const BANNED_WORDS = ["obviously", "trivially", "simply", "merely", "clearly"];
const DOUBLE_NEGATIVE = /\bis\s+not\s+un[a-z]+/i;
const TEXTBOOK_REF = /\b(Section|Chapter)\s+\d+(\.\d+)?\b/i;

const LENGTH_BAND = {
	easy: { lo: 80, hi: 150 },
	medium: { lo: 120, hi: 220 },
	hard: { lo: 180, hi: 320 },
};

function readAllStdin() {
	try {
		return readFileSync(0, "utf8");
	} catch {
		return "";
	}
}

function wordCount(s) {
	if (typeof s !== "string") return 0;
	return s.trim().split(/\s+/).filter(Boolean).length;
}

function checkQuestion(index, q) {
	const out = [];
	const stem = q?.question_text ?? "";
	const ans = q?.answer_key ?? {};
	const explanation = typeof ans.explanation === "string" ? ans.explanation : "";
	const commonMistakes = Array.isArray(ans.common_mistakes) ? ans.common_mistakes : [];
	const relatedConcept = typeof ans.related_concept === "string" ? ans.related_concept : "";

	for (const word of BANNED_WORDS) {
		const re = new RegExp(`\\b${word}\\b`, "i");
		if (re.test(stem) || re.test(explanation)) {
			out.push({ index, code: `uses_banned_word.${word}` });
		}
	}

	if (DOUBLE_NEGATIVE.test(stem)) {
		out.push({ index, code: "stem_double_negative" });
	}

	const firstClause = stem.split(/[.!?]/)[0] ?? "";
	if ((firstClause.match(/,/g) ?? []).length >= 3) {
		out.push({ index, code: "stem_too_many_qualifiers" });
	}

	for (const mistake of commonMistakes) {
		if (typeof mistake !== "string" || wordCount(mistake) < 8) {
			out.push({ index, code: "common_mistake_fragment" });
			break;
		}
	}

	if (TEXTBOOK_REF.test(relatedConcept)) {
		out.push({ index, code: "related_concept_textbook_ref" });
	}

	const difficulty = q?.difficulty_level;
	const band = difficulty && LENGTH_BAND[difficulty];
	if (band) {
		const wc = wordCount(explanation);
		if (wc > 0 && (wc < band.lo || wc > band.hi)) {
			out.push({
				index,
				code: "explanation_length_out_of_band",
				details: { wordCount: wc, lo: band.lo, hi: band.hi },
			});
		}
	}

	return out;
}

function lint(test) {
	const violations = [];
	const questions = Array.isArray(test?.questions) ? test.questions : [];
	for (let i = 0; i < questions.length; i++) {
		violations.push(...checkQuestion(i, questions[i]));
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
