import type { ServiceRoleClient } from "@/lib/supabase/admin";

type TopicContextChunkRow = {
	topic_id: string;
	content: string;
	chunk_type: string | null;
	source_ref: string | null;
	created_at: string;
};

const DOUBT_TOPIC_CONTEXT_MAX_CHARS_DEFAULT = 70_000;

function getContextCharBudget(): number {
	const raw = process.env.DOUBT_TOPIC_CONTEXT_MAX_CHARS?.trim();
	if (!raw) return DOUBT_TOPIC_CONTEXT_MAX_CHARS_DEFAULT;
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return DOUBT_TOPIC_CONTEXT_MAX_CHARS_DEFAULT;
	return Math.min(parsed, 200_000);
}

function normalizeRows(rows: TopicContextChunkRow[], topicOrder: string[]): TopicContextChunkRow[] {
	const orderMap = new Map(topicOrder.map((id, idx) => [id, idx]));
	return [...rows]
		.filter((r) => topicOrder.includes(r.topic_id))
		.map((r) => ({ ...r, content: r.content.trim() }))
		.filter((r) => r.content.length > 0)
		.sort((a, b) => {
			const ai = orderMap.get(a.topic_id) ?? Number.MAX_SAFE_INTEGER;
			const bi = orderMap.get(b.topic_id) ?? Number.MAX_SAFE_INTEGER;
			if (ai !== bi) return ai - bi;
			const ta = Date.parse(a.created_at);
			const tb = Date.parse(b.created_at);
			if (ta !== tb) return ta - tb;
			return a.content.localeCompare(b.content);
		});
}

function renderContextBlock(rows: TopicContextChunkRow[], topicOrder: string[]): { block: string; chunkCount: number } {
	const ordered = normalizeRows(rows, topicOrder);
	const maxChars = getContextCharBudget();
	let remaining = maxChars;
	const chunks: string[] = [];

	for (const row of ordered) {
		const entry = row.content;
		if (entry.length > remaining) break;
		chunks.push(entry);
		remaining -= entry.length + 2;
	}

	return {
		block: chunks.join("\n\n"),
		chunkCount: chunks.length,
	};
}

export async function fetchDoubtTopicContextBlockByTopicIds(
	admin: ServiceRoleClient,
	topicIds: string[],
): Promise<
	| { ok: true; block: string; chunkCount: number }
	| { ok: false; code: "context_chunks_query_failed" | "context_chunks_missing"; message: string }
> {
	const topicOrder = [...new Set(topicIds.filter(Boolean))];
	if (topicOrder.length === 0) {
		return { ok: false, code: "context_chunks_missing", message: "No topic ids found for this conversation." };
	}

	const { data, error } = await admin
		.from("topic_context_chunks")
		.select("topic_id, content, chunk_type, source_ref, created_at")
		.in("topic_id", topicOrder)
		.order("topic_id", { ascending: true })
		.order("created_at", { ascending: true });

	if (error) {
		return {
			ok: false,
			code: "context_chunks_query_failed",
			message: "Could not load topic context chunks.",
		};
	}

	const rendered = renderContextBlock((data ?? []) as TopicContextChunkRow[], topicOrder);
	if (rendered.chunkCount === 0) {
		return {
			ok: false,
			code: "context_chunks_missing",
			message: "This chat has no topic context chunks yet.",
		};
	}

	return { ok: true, block: rendered.block, chunkCount: rendered.chunkCount };
}
