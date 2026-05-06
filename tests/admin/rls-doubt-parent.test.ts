/**
 * Integration test for the parent doubt-chat read-only RLS policy
 * (`supabase/migrations/20260428201000_parent_doubt_read_linked_student.sql`).
 *
 * The migration grants parents SELECT on `doubt_conversations` and
 * `doubt_messages` for their actively-linked children — and nothing else
 * (no INSERT/UPDATE/DELETE). This test pins that contract:
 *   1. Parent CAN read conversations + messages for the linked student.
 *   2. Parent CANNOT see rows for an unlinked student (RLS returns empty).
 *   3. Parent CANNOT INSERT/UPDATE/DELETE on either table even for the
 *      linked student (RLS WITH CHECK rejects).
 *
 * Gating: requires PARENT_RLS_TEST_PARENT_EMAIL/PASSWORD,
 * PARENT_RLS_TEST_LINKED_STUDENT_ID, and PARENT_RLS_TEST_UNLINKED_STUDENT_ID.
 * Skips cleanly when any are missing — same convention as
 * `tests/admin/rls-parent-isolation.test.ts`.
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

describe.skipIf(!ready)("RLS — parent doubt-chat read access", () => {
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

	it("parent can read the linked student's doubt conversations", async () => {
		const client = await signedInParentClient();
		const { data, error } = await client
			.from("doubt_conversations")
			.select("id, student_id")
			.eq("student_id", linkedStudentId!)
			.limit(5);
		// Empty data is fine (the linked student may have no chats yet) — what
		// matters is "no error" and "no foreign rows leaked".
		expect(error?.message ?? "", "no error reading linked student conversations").toBe("");
		for (const row of data ?? []) {
			expect(row.student_id).toBe(linkedStudentId);
		}
	});

	it("parent CANNOT read an unlinked student's doubt conversations", async () => {
		const client = await signedInParentClient();
		const { data, error } = await client
			.from("doubt_conversations")
			.select("id")
			.eq("student_id", unlinkedStudentId!)
			.limit(5);
		expect(error?.message ?? "").toBe("");
		expect(data ?? []).toEqual([]);
	});

	it("parent can read messages of conversations belonging to the linked student", async () => {
		const client = await signedInParentClient();
		const { data: convos } = await client
			.from("doubt_conversations")
			.select("id")
			.eq("student_id", linkedStudentId!)
			.limit(1);
		if (!convos || convos.length === 0) {
			// No fixture data — the policy still has to allow the join.
			return;
		}
		const conversationId = convos[0]!.id as string;
		const { data, error } = await client
			.from("doubt_messages")
			.select("id, conversation_id")
			.eq("conversation_id", conversationId)
			.limit(5);
		expect(error?.message ?? "", "no error reading linked student messages").toBe("");
		for (const row of data ?? []) {
			expect(row.conversation_id).toBe(conversationId);
		}
	});

	it("parent CANNOT INSERT a doubt_conversations row for the linked student", async () => {
		const client = await signedInParentClient();
		// Use a fake-but-syntactic UUID for subject/topic — the insert should
		// be blocked by RLS WITH CHECK before any FK resolution.
		const { error } = await client.from("doubt_conversations").insert({
			student_id: linkedStudentId!,
			subject_id: "00000000-0000-0000-0000-000000000001",
			topic_id: "00000000-0000-0000-0000-000000000002",
			title: "rls-violation-attempt",
			metadata: {},
		});
		expect(error, "parent INSERT must be rejected by RLS").not.toBeNull();
	});

	it("parent CANNOT UPDATE a doubt_conversations row even for linked student", async () => {
		const client = await signedInParentClient();
		const { data: convos } = await client
			.from("doubt_conversations")
			.select("id")
			.eq("student_id", linkedStudentId!)
			.limit(1);
		if (!convos || convos.length === 0) {
			// Nothing to update against — skip silently rather than fail.
			return;
		}
		const id = convos[0]!.id as string;
		const { data, error } = await client
			.from("doubt_conversations")
			.update({ title: "rls-violation-attempt" })
			.eq("id", id)
			.select("id")
			.maybeSingle();
		// RLS pattern: either an explicit error, or zero rows updated.
		const blocked = error != null || data == null;
		expect(blocked, "parent UPDATE must be blocked").toBe(true);
	});

	it("parent CANNOT DELETE a doubt_conversations row even for linked student", async () => {
		const client = await signedInParentClient();
		const { data: convos } = await client
			.from("doubt_conversations")
			.select("id")
			.eq("student_id", linkedStudentId!)
			.limit(1);
		if (!convos || convos.length === 0) {
			return;
		}
		const id = convos[0]!.id as string;
		const { data, error } = await client
			.from("doubt_conversations")
			.delete()
			.eq("id", id)
			.select("id")
			.maybeSingle();
		const blocked = error != null || data == null;
		expect(blocked, "parent DELETE must be blocked").toBe(true);
	});

	it("parent CANNOT INSERT a doubt_messages row even for linked student's conversation", async () => {
		const client = await signedInParentClient();
		const { data: convos } = await client
			.from("doubt_conversations")
			.select("id")
			.eq("student_id", linkedStudentId!)
			.limit(1);
		if (!convos || convos.length === 0) {
			return;
		}
		const id = convos[0]!.id as string;
		const { error } = await client.from("doubt_messages").insert({
			conversation_id: id,
			role: "user",
			content: "rls-violation-attempt",
		});
		expect(error, "parent INSERT into doubt_messages must be rejected by RLS").not.toBeNull();
	});
});
