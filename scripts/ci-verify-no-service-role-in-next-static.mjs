#!/usr/bin/env node
/**
 * After `pnpm build`, ensure SUPABASE_SERVICE_ROLE_KEY (literal value) does not appear
 * under `.next/static` (client chunks). Uses UTF-8 reads; skips if env unset.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const needle = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!needle) {
	console.log("ci-verify-no-service-role-in-next-static: SKIP (SUPABASE_SERVICE_ROLE_KEY empty)");
	process.exit(0);
}

const staticDir = join(process.cwd(), ".next", "static");
if (!existsSync(staticDir)) {
	console.error("ci-verify-no-service-role-in-next-static: .next/static not found; run pnpm build first");
	process.exit(1);
}

/** @param {string} dir @returns {string[]} */
function walk(dir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		const st = statSync(p);
		if (st.isDirectory()) out.push(...walk(p));
		else out.push(p);
	}
	return out;
}

const files = walk(staticDir);
for (const file of files) {
	let text;
	try {
		text = readFileSync(file, "utf8");
	} catch {
		continue;
	}
	if (text.includes(needle)) {
		console.error(`ci-verify-no-service-role-in-next-static: service role value found in ${file}`);
		process.exit(1);
	}
}

console.log("ci-verify-no-service-role-in-next-static: OK (no literal service role in .next/static)");
