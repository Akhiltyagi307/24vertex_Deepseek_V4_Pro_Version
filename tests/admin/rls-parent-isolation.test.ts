/**
 * Integration test for the parent ↔ student RLS boundary.
 *
 * The audit flagged that parent isolation was untested at any layer: the only
 * thing standing between a curious parent and another family's data is RLS
 * policies on `profiles`, `tests`, `student_answers`, `performance_tracker`.
 * That trust hinge has had silent regressions in the past (e.g. an admin
 * column-level GRANT inadvertently widened the parent role's view) — a
 * targeted integration test is the cheapest place to catch it.
 *
 * What this test asserts:
 *   1. A signed-in parent CAN read profile rows for students they are linked to.
 *   2. A signed-in parent CANNOT read profile rows for students they are NOT
 *      linked to (RLS returns 0 rows, not a 4xx — that's the Postgres pattern).
 *   3. A signed-in parent CANNOT read another parent's link rows.
 *
 * Gating: requires PARENT_RLS_TEST_PARENT_EMAIL/PASSWORD,
 * PARENT_RLS_TEST_LINKED_STUDENT_ID, and PARENT_RLS_TEST_UNLINKED_STUDENT_ID.
 * Skips cleanly when any are missing — local devs without those fixtures
 * still see the rest of the suite pass.
 */
import { describe, expect, it } from "vitest";

import { createClient } from "@supabase/supabase-js";

function envOrSkip(...names: string[]): string | null {
	for (const n of names) {
		const v = process.env[n]?.trim();
		if (v) return v;
	}
	return null;
}

function getSupabaseAnon(): { url: string; key: string } | null {
	const url = envOrSkip("NEXT_PUBLIC_SUPABASE_URL");
	const key =
		envOrSkip("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
		envOrSkip("NEXT_PUBLIC_SUPABASE_ANON_KEY");
	if (!url || !key) return null;
	return { url, key };
}

const supabaseConfig = getSupabaseAnon();
const parentEmail = envOrSkip("PARENT_RLS_TEST_PARENT_EMAIL");
const parentPassword = envOrSkip("PARENT_RLS_TEST_PARENT_PASSWORD");
const linkedStudentId = envOrSkip("PARENT_RLS_TEST_LINKED_STUDENT_ID");
const unlinkedStudentId = envOrSkip("PARENT_RLS_TEST_UNLINKED_STUDENT_ID");

const ready = Boolean(
	supabaseConfig && parentEmail && parentPassword && linkedStudentId && unlinkedStudentId,
);

describe.skipIf(!ready)("RLS — parent isolation", () => {
	async function signedInParentClient() {
		const cfg = supabaseConfig!;
		const client = createClient(cfg.url, cfg.key, { auth: { persistSession: false } });
		const { error } = await client.auth.signInWithPassword({
			email: parentEmail!,
			password: parentPassword!,
		});
		if (error) throw new Error(`Parent sign-in failed: ${error.message}`);
		return client;
	}

	it("parent can read the linked student's profile", async () => {
		const client = await signedInParentClient();
		const { data, error } = await client
			.from("profiles")
			.select("id")
			.eq("id", linkedStudentId!)
			.maybeSingle();
		expect(error?.message ?? "", "no error reading linked student").toBe("");
		expect(data?.id).toBe(linkedStudentId);
	});

	it("parent CANNOT read an unlinked student's profile (RLS hides the row)", async () => {
		const client = await signedInParentClient();
		const { data, error } = await client
			.from("profiles")
			.select("id")
			.eq("id", unlinkedStudentId!)
			.maybeSingle();
		// Postgres RLS pattern: query succeeds but returns no rows.
		expect(error?.message ?? "").toBe("");
		expect(data, "unlinked student profile must NOT be visible").toBeNull();
	});

	it("parent CANNOT see other parents' link rows", async () => {
		const client = await signedInParentClient();
		// A parent should only see their own link rows. Querying for the
		// unlinked student in `parent_student_links` must yield nothing
		// (the link row exists for some OTHER parent, but RLS hides it).
		const { data, error } = await client
			.from("parent_student_links")
			.select("parent_id, student_id")
			.eq("student_id", unlinkedStudentId!)
			.limit(5);
		expect(error?.message ?? "").toBe("");
		expect(data ?? []).toEqual([]);
	});
});
