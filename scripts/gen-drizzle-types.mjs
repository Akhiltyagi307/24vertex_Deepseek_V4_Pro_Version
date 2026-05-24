#!/usr/bin/env node
/**
 * Generate TypeScript types from the live Supabase Postgres schema using the
 * Supabase CLI's `gen types` command. The output lives at
 * `src/db/__generated__/supabase.ts` and is used by `check-drizzle-postgres-parity.mjs`
 * as the source-of-truth comparison against the hand-written Drizzle schemas
 * under `src/db/schema/`.
 *
 * This script does NOT replace the Drizzle schemas — those remain the canonical
 * shape the app code imports. The generated file is a typecheck-only mirror.
 *
 * Usage:
 *   SUPABASE_PROJECT_REF=abcdef123 pnpm db:gen-types
 *
 * If `SUPABASE_PROJECT_REF` is unset, the script bails with a SKIP exit 0 so
 * it can be wired into CI without requiring every developer to have it set.
 */

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

function readEnv(...names) {
	for (const n of names) {
		const v = process.env[n];
		if (v && v.trim().length > 0) return v.trim();
	}
	return null;
}

const projectRef = readEnv("SUPABASE_PROJECT_REF");
if (!projectRef) {
	console.log("gen-drizzle-types: SKIP (SUPABASE_PROJECT_REF not set)");
	process.exit(0);
}

const outFile = join(process.cwd(), "src", "db", "__generated__", "supabase.ts");
mkdirSync(dirname(outFile), { recursive: true });

let stdout;
try {
	// `supabase gen types typescript` requires the Supabase CLI on PATH. CI
	// installs it via the Supabase setup-action; local devs can install with
	// `brew install supabase/tap/supabase` or `npx supabase`.
	stdout = execSync(`supabase gen types typescript --schema public --project-id ${projectRef}`, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	});
} catch (e) {
	console.error(`gen-drizzle-types: FAIL — ${e.message}`);
	process.exit(1);
}

const header = `// AUTO-GENERATED via \`pnpm db:gen-types\` — do not edit by hand.
// This file mirrors the live Postgres schema for use by
// scripts/check-drizzle-postgres-parity.mjs. The hand-written Drizzle
// schemas at src/db/schema/* remain the source of truth for app code.
`;

writeFileSync(outFile, header + stdout, "utf8");
console.log(`gen-drizzle-types: wrote ${outFile} (${stdout.length} bytes)`);
