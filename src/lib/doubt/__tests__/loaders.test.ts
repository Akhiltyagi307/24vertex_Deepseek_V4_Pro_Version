/**
 * Sliding-window history truncation for `loadDoubtMessagesForConversationWithClient`.
 *
 * The route handler now passes `{ limit: DOUBT_CHAT_HISTORY_TURN_CAP }` (10
 * turns = 20 messages) so the entire conversation no longer leaks into every
 * OpenAI call. This test pins the loader's contract:
 *   - With `limit`, returns at most `limit*2` messages, in chronological order,
 *     drawn from the most-recent slice.
 *   - Without `limit`, behaviour is unchanged: full thread, chronological.
 */
import { describe, expect, it, vi } from "vitest";

import { loadDoubtMessagesForConversationWithClient } from "@/lib/doubt/loaders";

vi.mock("@/lib/server/log-supabase-error", () => ({
	logSupabaseError: () => undefined,
	isPostgresUndefinedColumnError: () => false,
}));

type Row = { id: string; role: "user" | "assistant"; content: string; created_at: string };

function makeRows(n: number): Row[] {
	const out: Row[] = [];
	for (let i = 0; i < n; i++) {
		out.push({
			id: `msg-${String(i).padStart(4, "0")}`,
			role: i % 2 === 0 ? "user" : "assistant",
			content: `m${i}`,
			created_at: new Date(2026, 0, 1, 0, i, 0).toISOString(),
		});
	}
	return out;
}

type Supabase = {
	from: () => Builder;
};

type Builder = {
	select: () => Builder;
	eq: () => Builder;
	in: () => Builder;
	order: (col: string, opts?: { ascending?: boolean }) => Builder;
	limit: (n: number) => Promise<{ data: Row[]; error: null }>;
	then: (
		res: (v: { data: Row[]; error: null }) => unknown,
		rej?: (e: unknown) => unknown,
	) => Promise<unknown>;
};

/**
 * Build a tiny chainable Supabase mock that records the latest `.order` call
 * (asc/desc) and resolves to a slice of `rows` honouring `.limit(n)`.
 */
function buildSupabase(allRows: Row[]): Supabase {
	const state: { ascending: boolean; limit: number | null } = { ascending: true, limit: null };

	function serve(): { data: Row[]; error: null } {
		const ordered = state.ascending ? allRows : [...allRows].reverse();
		const sliced = state.limit == null ? ordered : ordered.slice(0, state.limit);
		return { data: sliced, error: null };
	}

	const builder: Builder = {
		select: () => builder,
		eq: () => builder,
		in: () => builder,
		order: (_col, opts) => {
			state.ascending = opts?.ascending ?? true;
			return builder;
		},
		limit: (n) => {
			state.limit = n;
			return Promise.resolve(serve());
		},
		then: (res, rej) => Promise.resolve(serve()).then(res, rej),
	};

	return {
		from: () => builder,
	};
}

describe("loadDoubtMessagesForConversationWithClient", () => {
	it("returns the FULL thread chronologically when limit is omitted", async () => {
		const rows = makeRows(8);
		const supabase = buildSupabase(rows);

		const result = await loadDoubtMessagesForConversationWithClient(supabase as never,"conv-1");

		expect(result.length).toBe(8);
		expect(result[0]!.id).toBe("msg-0000");
		expect(result.at(-1)!.id).toBe("msg-0007");
	});

	it("caps to limit*2 messages chronologically when limit is set", async () => {
		const rows = makeRows(30);
		const supabase = buildSupabase(rows);

		const result = await loadDoubtMessagesForConversationWithClient(supabase as never,"conv-2", {
			limit: 10,
		});

		expect(result.length).toBe(20);
		// Most recent 20 means msg-0010 through msg-0029, in chronological order.
		expect(result[0]!.id).toBe("msg-0010");
		expect(result.at(-1)!.id).toBe("msg-0029");
	});

	it("returns all rows when the conversation is shorter than the limit", async () => {
		const rows = makeRows(4);
		const supabase = buildSupabase(rows);

		const result = await loadDoubtMessagesForConversationWithClient(supabase as never,"conv-3", {
			limit: 10,
		});

		expect(result.length).toBe(4);
		expect(result[0]!.id).toBe("msg-0000");
		expect(result.at(-1)!.id).toBe("msg-0003");
	});

	it("treats limit <= 0 as 'no cap' (defensive)", async () => {
		const rows = makeRows(5);
		const supabase = buildSupabase(rows);

		const result = await loadDoubtMessagesForConversationWithClient(supabase as never,"conv-4", {
			limit: 0,
		});

		expect(result.length).toBe(5);
	});
});
