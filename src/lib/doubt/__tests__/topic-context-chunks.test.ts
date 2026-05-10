import { describe, expect, it } from "vitest";

import { fetchDoubtTopicContextBlockByTopicIds } from "@/lib/doubt/topic-context-chunks";

function makeAdminClientMock(result: { data: unknown; error: unknown }) {
	const state: { inValues: string[] | null; table: string | null } = {
		inValues: null,
		table: null,
	};
	const chain: Record<string, unknown> = {};
	chain.select = () => chain;
	chain.in = (_col: string, values: string[]) => {
		state.inValues = values;
		return chain;
	};
	chain.order = () => chain;
	chain.then = (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
		Promise.resolve(result).then(onFulfilled, onRejected);

	return {
		client: {
			from: (table: string) => {
				state.table = table;
				return chain;
			},
		},
		state,
	};
}

describe("fetchDoubtTopicContextBlockByTopicIds", () => {
	it("queries all selected chapter topic ids and returns chunk text only", async () => {
		const { client, state } = makeAdminClientMock({
			data: [
				{
					topic_id: "t-1",
					content: "First topic chunk.",
					chunk_type: "context",
					source_ref: "NCERT p.1",
					created_at: "2026-01-01T00:00:00.000Z",
				},
				{
					topic_id: "t-2",
					content: "Second topic chunk.",
					chunk_type: "exercise",
					source_ref: "NCERT p.2",
					created_at: "2026-01-02T00:00:00.000Z",
				},
			],
			error: null,
		});

		const res = await fetchDoubtTopicContextBlockByTopicIds(client as never, ["t-1", "t-2"]);
		expect(state.table).toBe("topic_context_chunks");
		expect(state.inValues).toEqual(["t-1", "t-2"]);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.block).toContain("First topic chunk.");
		expect(res.block).toContain("Second topic chunk.");
		expect(res.block).not.toContain("topic_id:");
		expect(res.block).not.toContain("chunk_type:");
		expect(res.block).not.toContain("source:");
	});

	it("queries only the selected topic id for topic-scoped chats", async () => {
		const { client, state } = makeAdminClientMock({
			data: [
				{
					topic_id: "only-topic",
					content: "Only topic chunk.",
					chunk_type: "context",
					source_ref: null,
					created_at: "2026-01-01T00:00:00.000Z",
				},
			],
			error: null,
		});

		const res = await fetchDoubtTopicContextBlockByTopicIds(client as never, ["only-topic"]);
		expect(state.inValues).toEqual(["only-topic"]);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.chunkCount).toBe(1);
		expect(res.block).toContain("Only topic chunk.");
	});
});
