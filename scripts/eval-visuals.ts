#!/usr/bin/env npx tsx
/**
 * pnpm eval:visuals
 *
 * Stem ↔ visual criteria use `stemNeedsVisualHint` from
 * `src/lib/practice/visuals/stem-visual-hints.ts` (shared with quality gates).
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { stemNeedsVisualHint } from "../src/lib/practice/visuals/stem-visual-hints";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIXTURES_DIR = path.join(ROOT, "tests", "eval-visuals", "fixtures");
const THRESHOLD = Number(process.env.PRACTICE_VISUALS_EVAL_THRESHOLD ?? "0.9");

const VISUAL_COPY_BANNED = [
	/\banswer\s+is\s+[abcd]\b/i,
	/\bcorrect\s+(option|choice)\s*[:.]?\s*[abcd]\b/i,
	/\boption\s+[abcd]\s+is\s+(correct|right|true)\b/i,
	/\bthe\s+correct\s+(answer|option|choice)\s+(is|are)\b/i,
];

function normLeak(s: unknown): string {
	return String(s ?? "")
		.toLowerCase()
		.replace(/\$/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function wordCount(s: unknown): number {
	return String(s ?? "")
		.trim()
		.split(/\s+/)
		.filter(Boolean).length;
}

function captionAltSubstantial(visual: unknown): boolean {
	if (visual == null || typeof visual !== "object") return true;
	const v = visual as { caption?: unknown; altText?: unknown };
	return wordCount(v.caption) >= 3 && wordCount(v.altText) >= 3;
}

function visualAntiSpoiler(q: Record<string, unknown>): boolean {
	const visual = (q.visual ?? null) as Record<string, unknown> | null;
	if (visual == null) return true;
	const stemN = normLeak(q.question_text);
	const pool = normLeak(`${visual.caption} ${visual.altText}`);
	for (const re of VISUAL_COPY_BANNED) {
		if (re.test(String(visual.caption)) || re.test(String(visual.altText))) return false;
	}
	const ca = String((q.answer_key as { correct_answer?: unknown } | undefined)?.correct_answer ?? "").trim();
	const options = q.options as Record<string, string> | null | undefined;
	const candidates: string[] = [];
	if (options && /^[ABCD]$/i.test(ca)) {
		const key = ca.toUpperCase() as keyof typeof options;
		const optText = options[key];
		if (optText && optText.length >= 5) candidates.push(normLeak(optText));
	}
	if (ca.length >= 5 && !/^[ABCD]$/i.test(ca)) {
		candidates.push(normLeak(ca));
		for (const part of ca.split(/[.;,:]+/)) {
			const p = part.trim();
			if (p.length >= 6) candidates.push(normLeak(p));
		}
	}
	for (const c of candidates) {
		if (c.length < 5) continue;
		if (!pool.includes(c)) continue;
		if (stemN.includes(c)) continue;
		return false;
	}
	return true;
}

const VALID_KINDS = new Set([
	"math_geometry",
	"math_function_plot",
	"number_line",
	"physics_diagram",
	"chemistry_molecule",
	"chemistry_reaction",
	"accountancy_table",
	"economics_curve",
	"statistics_chart",
	"data_table",
	"english_passage",
]);

function listSubjects(rootDir: string): string[] {
	if (!existsSync(rootDir)) return [];
	return readdirSync(rootDir).filter((name) => {
		const p = path.join(rootDir, name);
		return statSync(p).isDirectory();
	});
}

function listFixtures(subjectDir: string): string[] {
	if (!existsSync(subjectDir)) return [];
	return readdirSync(subjectDir)
		.filter((f) => f.endsWith(".json"))
		.map((f) => path.join(subjectDir, f));
}

function scoreQuestion(q: Record<string, unknown>) {
	const stem = typeof q.question_text === "string" ? q.question_text : "";
	const visual = (q.visual ?? null) as unknown;
	const stemNeedsVisual = stemNeedsVisualHint(stem);
	const visualEmitted = visual != null;

	const visualWhenNeeded = stemNeedsVisual === visualEmitted;
	const specValid = visual == null ? true : isVisualSpecLikelyValid(visual as Record<string, unknown>);
	const renders = visual == null ? true : passesRendererPreconditions(visual as { spec: Record<string, unknown> });
	const stemSelfContained = visual != null ? true : !stemNeedsVisualHint(stem);

	const captionAltOk = captionAltSubstantial(visual);
	const antiSpoiler = visualAntiSpoiler(q);

	const passed = [
		visualWhenNeeded,
		specValid,
		renders,
		stemSelfContained,
		captionAltOk,
		antiSpoiler,
	].every(Boolean);
	return {
		passed,
		visualWhenNeeded,
		specValid,
		renders,
		stemSelfContained,
		captionAltSubstantial: captionAltOk,
		visualAntiSpoiler: antiSpoiler,
	};
}

function isVisualSpecLikelyValid(visual: Record<string, unknown>): boolean {
	if (typeof visual !== "object" || visual == null) return false;
	if (typeof visual.caption !== "string" || visual.caption.length === 0) return false;
	if (typeof visual.altText !== "string" || visual.altText.length === 0) return false;
	const spec = visual.spec as Record<string, unknown> | null;
	if (typeof spec !== "object" || spec == null) return false;
	if (typeof spec.kind !== "string" || !VALID_KINDS.has(spec.kind)) return false;
	return true;
}

function passesRendererPreconditions(visual: { spec: Record<string, unknown> }): boolean {
	const spec = visual.spec;
	switch (spec.kind) {
		case "math_geometry": {
			const view = spec.view as Record<string, number> | undefined;
			return !!(
				view &&
				typeof view.xMin === "number" &&
				typeof view.xMax === "number" &&
				view.xMin < view.xMax &&
				typeof view.yMin === "number" &&
				typeof view.yMax === "number" &&
				view.yMin < view.yMax &&
				Array.isArray(spec.primitives) &&
				spec.primitives.length > 0
			);
		}
		case "math_function_plot":
			return (
				typeof spec.xMin === "number" &&
				typeof spec.xMax === "number" &&
				spec.xMin < spec.xMax &&
				Array.isArray(spec.items) &&
				spec.items.length > 0 &&
				(spec.items as { expr?: string }[]).every((i) => typeof i.expr === "string" && i.expr.length > 0)
			);
		case "number_line":
			return (
				typeof spec.min === "number" &&
				typeof spec.max === "number" &&
				spec.min < spec.max &&
				typeof spec.tickStep === "number" &&
				spec.tickStep > 0
			);
		case "physics_diagram":
			return typeof spec.subKind === "string";
		case "chemistry_molecule":
			return typeof spec.smiles === "string" && spec.smiles.length > 0;
		case "chemistry_reaction":
			return typeof spec.ce === "string" && spec.ce.length > 0;
		case "accountancy_table":
			return typeof spec.subKind === "string";
		case "economics_curve":
			return Array.isArray(spec.curves) && spec.curves.length > 0;
		case "statistics_chart":
			return typeof spec.subKind === "string";
		case "data_table":
			return Array.isArray(spec.headers) && Array.isArray(spec.rows);
		case "english_passage":
			return Array.isArray(spec.lines) && spec.lines.length > 0;
		default:
			return false;
	}
}

function summarizeSubject(
	name: string,
	results: ReturnType<typeof scoreQuestion>[],
) {
	const total = results.length;
	const passed = results.filter((r) => r.passed).length;
	const passRate = total === 0 ? 0 : passed / total;
	const breakdown = {
		visual_when_needed: results.filter((r) => r.visualWhenNeeded).length,
		spec_valid: results.filter((r) => r.specValid).length,
		renders: results.filter((r) => r.renders).length,
		stem_self_contained: results.filter((r) => r.stemSelfContained).length,
		caption_alt: results.filter((r) => r.captionAltSubstantial).length,
		anti_spoiler: results.filter((r) => r.visualAntiSpoiler).length,
	};
	return { name, total, passed, passRate, breakdown };
}

function formatRow(s: ReturnType<typeof summarizeSubject>) {
	const pct = s.total === 0 ? "  n/a" : `${(s.passRate * 100).toFixed(1)}%`.padStart(6);
	return `${s.name.padEnd(24)}  ${String(s.passed).padStart(3)} / ${String(s.total).padEnd(3)}  ${pct}  v=${s.breakdown.visual_when_needed} s=${s.breakdown.spec_valid} r=${s.breakdown.renders} c=${s.breakdown.stem_self_contained} cap=${s.breakdown.caption_alt} ns=${s.breakdown.anti_spoiler}`;
}

function main() {
	const subjects = listSubjects(FIXTURES_DIR);
	if (subjects.length === 0) {
		console.log(
			"No fixtures found under tests/eval-visuals/fixtures/. Skipping eval (this is fine for first runs).",
		);
		console.log(
			"To populate: drop generated `questions[i]` JSON blobs under tests/eval-visuals/fixtures/<subject>/ and rerun.",
		);
		process.exit(0);
	}

	console.log("Subject                    pass / N   rate    breakdown");
	console.log("───────────────────────────────────────────────────────────────");

	let allPassed = true;
	for (const subject of subjects.sort()) {
		const dir = path.join(FIXTURES_DIR, subject);
		const files = listFixtures(dir);
		const results = files.map((file) => {
			const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
			return scoreQuestion(raw);
		});
		const summary = summarizeSubject(subject, results);
		console.log(formatRow(summary));
		if (summary.total > 0 && summary.passRate < THRESHOLD) {
			allPassed = false;
		}
	}

	console.log("");
	if (!allPassed) {
		console.error(`✖ At least one subject is below the ${(THRESHOLD * 100).toFixed(0)}% threshold.`);
		process.exit(1);
	}
	console.log(`✓ All subjects at or above the ${(THRESHOLD * 100).toFixed(0)}% threshold.`);
}

main();
