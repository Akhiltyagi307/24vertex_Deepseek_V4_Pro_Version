/**
 * Applies Phase 2 admin SQL migrations to the database pointed at by DATABASE_URL.
 * Loads .env.local from the repo root when present (same pattern as drizzle.config.ts).
 *
 * Usage:
 *   pnpm run db:apply:admin-phase2
 *   DATABASE_URL=postgres://... pnpm exec node scripts/apply-admin-phase2-migrations.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

config({ path: path.join(root, ".env.local") });

const url = process.env.DATABASE_URL?.trim();
if (!url) {
	console.error("DATABASE_URL is not set. Add it to .env.local or export it.");
	process.exit(1);
}

const files = [
	"supabase/migrations/20260502150000_admin_saved_views.sql",
	"supabase/migrations/20260502151000_profiles_grade_stream_index.sql",
];

const useSsl = !/localhost|127\.0\.0\.1/.test(url);
const sql = postgres(url, { max: 1, ...(useSsl ? { ssl: "require" } : {}) });

try {
	for (const rel of files) {
		const full = path.join(root, rel);
		if (!fs.existsSync(full)) {
			console.error("Missing file:", full);
			process.exit(1);
		}
		const content = fs.readFileSync(full, "utf8");
		await sql.unsafe(content);
		console.log("Applied:", rel);
	}
	console.log("All migrations applied successfully.");
} catch (e) {
	console.error(e);
	process.exit(1);
} finally {
	await sql.end({ timeout: 5 });
}
