#!/usr/bin/env node
/**
 * Prints ADMIN_PASSWORD_HASH_B64 (base64 of bcrypt hash, cost 12) for .env.local / Vercel.
 * Uses the project's bcryptjs dependency — run from repo root after `pnpm install`.
 *
 *   pnpm run admin:password-hash-b64 -- 'your-strong-password'
 *
 * Password appears in shell history; prefer a throwaway password then change after first login.
 */
import bcrypt from "bcryptjs";

const pwd = process.argv[2];
if (!pwd || pwd === "-h" || pwd === "--help") {
	console.error("Usage: pnpm run admin:password-hash-b64 -- '<password>'");
	console.error("   or: node scripts/admin-password-hash-b64.mjs '<password>'");
	process.exit(pwd === "-h" || pwd === "--help" ? 0 : 1);
}

const h = bcrypt.hashSync(pwd, 12);
process.stdout.write(`${Buffer.from(h, "utf8").toString("base64")}\n`);
