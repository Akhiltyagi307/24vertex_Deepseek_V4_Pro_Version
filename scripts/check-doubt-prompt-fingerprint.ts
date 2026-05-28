/**
 * Doubt-prompt fingerprint checker.
 *
 * Computes the SHA-256 of each rendered doubt-tutor prompt body (the bytes
 * between `<<<DOUBT_PROMPT` and `DOUBT_PROMPT` markers) and compares against
 * the baseline in `docs/doubt-prompt-fingerprint.json`.
 *
 * Run as part of CI on PRs touching `docs/*.md` under the doubt-tutor set.
 * If a fingerprint changes, the PR author must:
 *   1. Confirm the edit is intentional.
 *   2. Run this script with `--write` to commit the new baseline.
 *   3. Acknowledge the cache-invalidation impact in the PR description.
 *
 * Why a script and not a unit test: this is a deliberately *gating* check —
 * a normal test would just pass after the doc was edited, since the test
 * would also see the new bytes. The baseline file is the audit trail.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DOCS = [
	"doubt-shared-preamble.md",
	"explain-mode-prompt.md",
	"solve-with-me-mode-prompt.md",
	"quiz-me-mode-prompt.md",
] as const;

const SUBJECT_PACK_DOCS = [
	"doubt-subject-packs/mathematics.md",
	"doubt-subject-packs/science.md",
	"doubt-subject-packs/physics.md",
	"doubt-subject-packs/chemistry.md",
	"doubt-subject-packs/biology.md",
	"doubt-subject-packs/social-science.md",
	"doubt-subject-packs/history.md",
	"doubt-subject-packs/geography.md",
	"doubt-subject-packs/political-science.md",
	"doubt-subject-packs/economics.md",
	"doubt-subject-packs/english.md",
	"doubt-subject-packs/computer-science.md",
] as const;

const MARKER_START = "<<<DOUBT_PROMPT";
const MARKER_END = "DOUBT_PROMPT";

function extractBody(filePath: string): string {
	const raw = readFileSync(filePath, "utf8");
	const startIdx = raw.indexOf(MARKER_START);
	if (startIdx === -1) {
		throw new Error(`Missing ${MARKER_START} in ${filePath}`);
	}
	const afterStart = raw.slice(startIdx + MARKER_START.length);
	const bodyStart = afterStart.startsWith("\n") ? 1 : 0;
	const fromBody = afterStart.slice(bodyStart);
	const endIdx = fromBody.indexOf(`\n${MARKER_END}`);
	if (endIdx === -1) {
		throw new Error(`Missing closing ${MARKER_END} line in ${filePath}`);
	}
	return fromBody.slice(0, endIdx).trim();
}

function sha256(s: string): string {
	return createHash("sha256").update(s, "utf8").digest("hex");
}

const current: Record<string, { sha256: string; bodyChars: number }> = {};
for (const file of DOCS) {
	const body = extractBody(join(ROOT, "docs", file));
	current[file] = { sha256: sha256(body), bodyChars: body.length };
}
for (const file of SUBJECT_PACK_DOCS) {
	const body = extractBody(join(ROOT, "docs", file));
	current[file] = { sha256: sha256(body), bodyChars: body.length };
}

const baselinePath = join(ROOT, "docs", "doubt-prompt-fingerprint.json");
const writing = process.argv.includes("--write");

if (writing) {
	writeFileSync(
		baselinePath,
		`${JSON.stringify(
			{
				_note: "SHA-256 of each doubt-tutor prompt body. Run scripts/check-doubt-prompt-fingerprint.ts --write to update. See docs/conventions.md > Prompt cache hygiene.",
				files: current,
			},
			null,
			2,
		)}\n`,
		"utf8",
	);
	console.log(`Wrote baseline: ${baselinePath}`);
	process.exit(0);
}

type BaselineShape = {
	pending_initial_seed?: boolean;
	files?: Record<string, { sha256: string }>;
};
let baseline: BaselineShape | null = null;
try {
	baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as BaselineShape;
} catch {
	console.error(
		`Baseline missing at ${baselinePath}. Run with --write to create it (first time only).`,
	);
	process.exit(1);
}

if (baseline?.pending_initial_seed === true) {
	console.warn(
		"Doubt-prompt fingerprint baseline is pending initial seed. Run with --write once to seed, then commit.",
	);
	// Non-fatal so the first CI run after the convention lands doesn't break.
	process.exit(0);
}

const drift: string[] = [];
for (const file of [...DOCS, ...SUBJECT_PACK_DOCS]) {
	const expected = baseline?.files?.[file]?.sha256;
	const got = current[file]!.sha256;
	if (!expected) {
		drift.push(`  ${file}: missing from baseline (got ${got.slice(0, 12)}…)`);
		continue;
	}
	if (expected !== got) {
		drift.push(`  ${file}: expected ${expected.slice(0, 12)}… got ${got.slice(0, 12)}…`);
	}
}

if (drift.length > 0) {
	console.error("Doubt-prompt fingerprint drift detected:");
	for (const line of drift) console.error(line);
	console.error("");
	console.error("If the change is intentional:");
	console.error(
		"  1. Acknowledge the cache-invalidation impact in your PR description (see docs/conventions.md > Prompt cache hygiene).",
	);
	console.error("  2. Run: pnpm exec tsx scripts/check-doubt-prompt-fingerprint.ts --write");
	console.error("  3. Commit the updated docs/doubt-prompt-fingerprint.json.");
	process.exit(1);
}

console.log("Doubt-prompt fingerprints OK.");
