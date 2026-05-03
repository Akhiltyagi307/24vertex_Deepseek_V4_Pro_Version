#!/usr/bin/env node
/**
 * Phase 6 release helper: prints implementation-plan §10.6 checklist items and runs
 * the client-bundle service-role grep when SUPABASE_SERVICE_ROLE_KEY and .next/static exist.
 *
 * Does not print secret values. Safe to run locally after `pnpm build`.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

console.log(`
Admin panel — security review (implementation plan §10.6)
------------------------------------------------------------
Automated in CI (when secrets set):
  [x] Service-role key absent from .next/static — node scripts/ci-verify-no-service-role-in-next-static.mjs (after pnpm build)

Manual / ops (cannot be fully scripted here):
  [ ] All env vars in Vercel production
  [ ] CSP set; noindex,nofollow headers verified on admin surfaces
  [ ] Bcrypt cost ≥ 12; password rotated since dev
  [ ] TOTP enrolled for live admin
  [ ] IP allowlist active (or explicitly waived with documented reason)
  [ ] Panic token saved outside Vercel
  [ ] Sentry alert for brute force (e.g. throughput on \`admin_login:*\` messages, tag admin_login_code, or DB \`admin_action_log\` rows with action login_failed) — plan text says login_failed > 10/min
  [ ] admin_action_log immutability self-test passing in production
`);

const staticDir = join(dirname(root), ".next", "static");
const hasBuild = existsSync(staticDir);
const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

if (!hasBuild) {
	console.log("admin-security-phase6: skip grep (.next/static missing — run pnpm build first)");
	process.exit(0);
}

if (!hasKey) {
	console.log("admin-security-phase6: skip grep (SUPABASE_SERVICE_ROLE_KEY empty)");
	process.exit(0);
}

const r = spawnSync(process.execPath, [join(root, "ci-verify-no-service-role-in-next-static.mjs")], {
	stdio: "inherit",
	cwd: dirname(root),
	env: process.env,
});
process.exit(r.status ?? 1);
