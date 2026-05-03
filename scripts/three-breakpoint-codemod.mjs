/**
 * Migrates Tailwind responsive prefixes to the app's three breakpoints:
 * - Small: default (< 768px)
 * - medium: — tablet+ (48rem)
 * - xl: — laptop+ (64rem)
 *
 * Replaces only prefixes where the next character is non-whitespace (avoids CVA keys like `sm: "`).
 * Run from repo root: node scripts/three-breakpoint-codemod.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SKIP_DIRS = new Set([
	"node_modules",
	".next",
	".git",
	"dist",
	"out",
	"coverage",
	"playwright-report",
	"test-results",
]);
const ALLOW_EXT = new Set([".tsx", ".ts", ".css"]);
const SKIP_FILES = new Set(["tw-debug.css"]);

/** Order matters: longer / more specific first. */
const REPLACEMENTS = [
	[/\bmax-2xl:(?=\S)/g, "max-xl:"],
	[/\bmax-lg:(?=\S)/g, "max-xl:"],
	[/\bmax-md:(?=\S)/g, "max-medium:"],
	[/\bmax-sm:(?=\S)/g, "max-medium:"],
	[/\b2xl:(?=\S)/g, "xl:"],
	[/\blg:(?=\S)/g, "xl:"],
	[/\bmd:(?=\S)/g, "medium:"],
	[/\bsm:(?=\S)/g, "medium:"],
];

function walk(dir, out = []) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const e of entries) {
		if (SKIP_DIRS.has(e.name)) continue;
		const full = path.join(dir, e.name);
		if (e.isDirectory()) walk(full, out);
		else if (e.isFile()) {
			const ext = path.extname(e.name);
			if (!ALLOW_EXT.has(ext)) continue;
			if (SKIP_FILES.has(e.name)) continue;
			out.push(full);
		}
	}
	return out;
}

function transform(content) {
	let s = content;
	for (const [re, to] of REPLACEMENTS) {
		s = s.replace(re, to);
	}
	return s;
}

function main() {
	const files = walk(ROOT);
	let changed = 0;
	for (const file of files) {
		const before = fs.readFileSync(file, "utf8");
		const after = transform(before);
		if (after !== before) {
			fs.writeFileSync(file, after, "utf8");
			changed++;
			console.log(path.relative(ROOT, file));
		}
	}
	console.log(`\nUpdated ${changed} files.`);
}

main();
