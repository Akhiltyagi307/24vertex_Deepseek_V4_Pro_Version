#!/usr/bin/env node
/**
 * pnpm eval:visuals
 *
 * Scores fixture practice questions against the four-criterion gate from
 * the v2 visuals guide (§6) and aborts when any subject falls below the
 * configured threshold (default 90%).
 *
 * Fixtures live under `tests/eval-visuals/fixtures/<subject>/*.json`.
 * Each fixture is one element of `PracticeGenerationOutput["questions"]`
 * — a single generated question with its visual envelope. Adding a new
 * subject is as simple as creating its directory and dropping in JSON
 * files.
 *
 * Criteria (each scored boolean):
 *   1. visual_when_needed — stem references a figure/diagram/table/etc.
 *      ⇔ visual is non-null. Catches the "every question gets a visual"
 *      and "stem promises a figure but emits null" failure modes in the
 *      same gate.
 *   2. spec_valid — visual envelope (if present) round-trips through
 *      questionVisualEnvelopeSchema.
 *   3. renders — heuristic check that the spec passes the renderer's
 *      precondition guards (we don't actually mount React here; that's
 *      what the Playwright e2e covers).
 *   4. stem_self_contained — when visual is null, the stem doesn't
 *      reference "above/below/shown".
 *
 * Threshold: configurable via PRACTICE_VISUALS_EVAL_THRESHOLD (default 0.9).
 *
 * Output:
 *   • Human-readable per-subject table to stdout.
 *   • Exit code 0 when every subject is at or above the threshold (or
 *     when no fixtures exist — useful for early CI runs); exit 1 when a
 *     subject is below.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIXTURES_DIR = path.join(ROOT, "tests", "eval-visuals", "fixtures");
const THRESHOLD = Number(process.env.PRACTICE_VISUALS_EVAL_THRESHOLD ?? "0.9");

/**
 * Stems that match this regex need a visual. Covers both the explicit
 * "the figure / diagram / etc." pattern AND the relative-position pattern
 * ("shown below", "above"). Used by both criteria 1 (visual when needed)
 * and 4 (stem self-contained).
 */
const STEM_NEEDS_VISUAL_HINT =
	/\b(the\s+(figure|diagram|graph|table|circuit|structure|image|drawing)|shown\s+(below|above|here)|in\s+the\s+(figure|diagram|graph|table)|on\s+the\s+(right|left)\b|above|below)\b/i;
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

function listSubjects(rootDir) {
	if (!existsSync(rootDir)) return [];
	return readdirSync(rootDir).filter((name) => {
		const p = path.join(rootDir, name);
		return statSync(p).isDirectory();
	});
}

function listFixtures(subjectDir) {
	if (!existsSync(subjectDir)) return [];
	return readdirSync(subjectDir)
		.filter((f) => f.endsWith(".json"))
		.map((f) => path.join(subjectDir, f));
}

function scoreQuestion(q) {
	const stem = typeof q.question_text === "string" ? q.question_text : "";
	const visual = q.visual ?? null;
	const stemNeedsVisual = STEM_NEEDS_VISUAL_HINT.test(stem);
	const visualEmitted = visual != null;

	const visualWhenNeeded = stemNeedsVisual === visualEmitted;
	const specValid = visual == null ? true : isVisualSpecLikelyValid(visual);
	const renders = visual == null ? true : passesRendererPreconditions(visual);
	const stemSelfContained =
		visual != null ? true : !STEM_NEEDS_VISUAL_HINT.test(stem);

	const passed = [visualWhenNeeded, specValid, renders, stemSelfContained].every(
		Boolean,
	);
	return {
		passed,
		visualWhenNeeded,
		specValid,
		renders,
		stemSelfContained,
	};
}

function isVisualSpecLikelyValid(visual) {
	if (typeof visual !== "object" || visual == null) return false;
	if (typeof visual.caption !== "string" || visual.caption.length === 0) return false;
	if (typeof visual.altText !== "string" || visual.altText.length === 0) return false;
	const spec = visual.spec;
	if (typeof spec !== "object" || spec == null) return false;
	if (typeof spec.kind !== "string" || !VALID_KINDS.has(spec.kind)) return false;
	return true;
}

function passesRendererPreconditions(visual) {
	const spec = visual.spec;
	switch (spec.kind) {
		case "math_geometry":
			return (
				spec.view &&
				typeof spec.view.xMin === "number" &&
				typeof spec.view.xMax === "number" &&
				spec.view.xMin < spec.view.xMax &&
				typeof spec.view.yMin === "number" &&
				typeof spec.view.yMax === "number" &&
				spec.view.yMin < spec.view.yMax &&
				Array.isArray(spec.primitives) &&
				spec.primitives.length > 0
			);
		case "math_function_plot":
			return (
				typeof spec.xMin === "number" &&
				typeof spec.xMax === "number" &&
				spec.xMin < spec.xMax &&
				Array.isArray(spec.items) &&
				spec.items.length > 0 &&
				spec.items.every((i) => typeof i.expr === "string" && i.expr.length > 0)
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

function summarizeSubject(name, results) {
	const total = results.length;
	const passed = results.filter((r) => r.passed).length;
	const passRate = total === 0 ? 0 : passed / total;
	const breakdown = {
		visual_when_needed: results.filter((r) => r.visualWhenNeeded).length,
		spec_valid: results.filter((r) => r.specValid).length,
		renders: results.filter((r) => r.renders).length,
		stem_self_contained: results.filter((r) => r.stemSelfContained).length,
	};
	return { name, total, passed, passRate, breakdown };
}

function formatRow(s) {
	const pct = s.total === 0 ? "  n/a" : `${(s.passRate * 100).toFixed(1)}%`.padStart(6);
	return `${s.name.padEnd(24)}  ${String(s.passed).padStart(3)} / ${String(s.total).padEnd(3)}  ${pct}  v=${s.breakdown.visual_when_needed} s=${s.breakdown.spec_valid} r=${s.breakdown.renders} c=${s.breakdown.stem_self_contained}`;
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

	const allSummaries = [];
	let allPassed = true;
	for (const subject of subjects.sort()) {
		const dir = path.join(FIXTURES_DIR, subject);
		const files = listFixtures(dir);
		const results = files.map((file) => {
			const raw = JSON.parse(readFileSync(file, "utf8"));
			return scoreQuestion(raw);
		});
		const summary = summarizeSubject(subject, results);
		allSummaries.push({ summary, fileCount: files.length });
		console.log(formatRow(summary));
		if (summary.total > 0 && summary.passRate < THRESHOLD) {
			allPassed = false;
		}
	}

	console.log("");
	if (!allPassed) {
		console.error(
			`✖ At least one subject is below the ${(THRESHOLD * 100).toFixed(0)}% threshold.`,
		);
		process.exit(1);
	}
	console.log(`✓ All subjects at or above the ${(THRESHOLD * 100).toFixed(0)}% threshold.`);
}

main();
