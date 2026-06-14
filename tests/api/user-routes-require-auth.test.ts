import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Backstop for review finding H5: unlike the admin tree (uniform requireAdminApi,
 * guarded by tests/admin/admin-routes-require-auth.test.ts), the student/parent/
 * teacher API trees authenticate via several different mechanisms and have no
 * central chokepoint — so a new route that forgets auth entirely would be
 * reachable by anyone. This test fails CI if any user-facing route references
 * none of the recognized auth entry points.
 *
 * Scope/limits: this is a coarse PRESENCE check (does the route authenticate at
 * all?), not a per-role/ownership-correctness check — that finer guarantee is
 * covered by the M5 service-role IDOR audit. It exists to stop the egregious
 * "no auth at all" regression.
 */
const AUTH_PATTERNS: RegExp[] = [
	/\.auth\.getUser\s*\(/, // createClient() + supabase.auth.getUser()
	/getApiRequestUser\s*\(/,
	/requireApiStudent\s*\(/, // getApiRequestUser + student-role assertion
	/getServerUser\s*\(/,
	/requireVerifiedStudent\s*\(/,
	/resolveStudentQnaViewer\s*\(/,
	/requireParent\s*\(/,
	/resolveParentQnaViewer\s*\(/,
	/getVerifiedTeacherSession\s*\(/,
	/resolveDoubtScopeForConversation\s*\(/,
];

/** Intentionally-public user-facing routes (none today). Add with a reason. */
const PUBLIC_ALLOWLIST = new Set<string>([]);

const ROOTS = ["app/api/student", "app/api/parent", "app/api/teacher"];

function walkRoutes(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const abs = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walkRoutes(abs));
		else if (entry.name === "route.ts") out.push(abs);
	}
	return out;
}

describe("user-facing API routes authenticate the caller (H5)", () => {
	const files = ROOTS.flatMap((r) => walkRoutes(join(process.cwd(), r)));

	it("discovers the user-facing route trees", () => {
		expect(files.length).toBeGreaterThan(20);
	});

	for (const file of files) {
		const rel = file.slice(file.indexOf("app/api/"));
		const isPublic = PUBLIC_ALLOWLIST.has(rel);
		it(`${rel} ${isPublic ? "is allowlisted public" : "references an auth guard"}`, () => {
			const src = readFileSync(file, "utf8");
			const authed = AUTH_PATTERNS.some((re) => re.test(src));
			if (isPublic) {
				expect(authed).toBe(false);
			} else {
				expect(
					authed,
					`${rel} references no recognized authentication entry point. Add one (or, if it is genuinely public, add it to PUBLIC_ALLOWLIST in this test with a reason).`,
				).toBe(true);
			}
		});
	}
});
