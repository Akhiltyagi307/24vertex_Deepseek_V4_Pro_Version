#!/usr/bin/env node
/**
 * Scans prerendered HTML under `.next` for inline <script> bodies and writes
 * SHA-256 CSP hashes to `src/lib/security/public-csp-hashes.ts`.
 *
 * Run after `pnpm run build`:
 *   node scripts/compute-public-csp-hashes.mjs
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NEXT_DIR = join(ROOT, ".next");
const OUT_FILE = join(ROOT, "src/lib/security/public-csp-hashes.ts");

function walkHtmlFiles(dir, acc = []) {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		const st = statSync(full);
		if (st.isDirectory()) {
			if (name === "cache" || name === "node_modules") continue;
			walkHtmlFiles(full, acc);
			continue;
		}
		if (name.endsWith(".html") || name.endsWith(".rsc")) {
			acc.push(full);
		}
	}
	return acc;
}

function inlineScriptBodies(html) {
	const bodies = [];
	const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
	let m;
	while ((m = re.exec(html)) !== null) {
		const body = m[1]?.trim();
		if (body && !body.startsWith("{")) {
			bodies.push(body);
		}
	}
	return bodies;
}

function sha256CspHash(source) {
	const digest = createHash("sha256").update(source, "utf8").digest("base64");
	return `'sha256-${digest}'`;
}

const files = walkHtmlFiles(NEXT_DIR);
const hashSet = new Set();

for (const file of files) {
	const rel = relative(NEXT_DIR, file);
	if (!rel.includes("(public)") && !rel.includes("legal")) continue;
	const html = readFileSync(file, "utf8");
	for (const body of inlineScriptBodies(html)) {
		hashSet.add(sha256CspHash(body));
	}
}

const hashes = [...hashSet].sort();
const ts = `/**
 * SHA-256 script hashes for public marketing CSP (\`script-src 'sha256-…'\`).
 *
 * Regenerate after Next.js upgrades or marketing layout changes:
 *   pnpm run build && node scripts/compute-public-csp-hashes.mjs
 */
export const PUBLIC_CSP_SCRIPT_HASHES: readonly string[] = ${JSON.stringify(hashes, null, "\t").replace(/\n/g, "\n")} as const;
`;

writeFileSync(OUT_FILE, ts);
console.log(`Wrote ${hashes.length} script hash(es) to ${relative(ROOT, OUT_FILE)}`);
