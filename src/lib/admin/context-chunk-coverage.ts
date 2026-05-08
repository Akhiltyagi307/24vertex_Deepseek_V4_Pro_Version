import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

export type TopicChunkCoverageRow = {
	topic_id: string;
	topic_name: string | null;
	subject_id: string | null;
	grade: number | null;
};

export async function listTopicsWithZeroContextChunks(): Promise<TopicChunkCoverageRow[]> {
	const res = await db.execute(sql`
		SELECT t.id AS topic_id, t.topic_name, t.subject_id, t.grade
		FROM topics t
		LEFT JOIN topic_context_chunks c
			ON c.topic_id = t.id AND c.chunk_type = 'context'
		WHERE t.is_active IS DISTINCT FROM false
		GROUP BY t.id, t.topic_name, t.subject_id, t.grade
		HAVING COUNT(c.id) = 0
		ORDER BY t.grade, t.topic_name
		LIMIT 500
	`);
	return [...res] as TopicChunkCoverageRow[];
}

export type ContextChunkStats = {
	totalChunks: number;
	contextCount: number;
	exerciseCount: number;
	embeddedCount: number;
	distinctTopics: number;
	activeTopics: number;
	lastIngestedAt: string | null;
};

export async function getContextChunkStats(): Promise<ContextChunkStats> {
	const res = await db.execute(sql`
		WITH chunk_agg AS (
			SELECT
				COUNT(*)::int AS total_chunks,
				COUNT(*) FILTER (WHERE chunk_type = 'context')::int AS context_count,
				COUNT(*) FILTER (WHERE chunk_type = 'exercise')::int AS exercise_count,
				COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS embedded_count,
				COUNT(DISTINCT topic_id)::int AS distinct_topics,
				MAX(created_at) AS last_ingested_at
			FROM topic_context_chunks
		),
		topic_agg AS (
			SELECT COUNT(*)::int AS active_topics
			FROM topics
			WHERE is_active IS DISTINCT FROM false
		)
		SELECT
			chunk_agg.total_chunks,
			chunk_agg.context_count,
			chunk_agg.exercise_count,
			chunk_agg.embedded_count,
			chunk_agg.distinct_topics,
			topic_agg.active_topics,
			chunk_agg.last_ingested_at
		FROM chunk_agg, topic_agg
	`);
	const row = res[0] as
		| {
				total_chunks: number;
				context_count: number;
				exercise_count: number;
				embedded_count: number;
				distinct_topics: number;
				active_topics: number;
				last_ingested_at: Date | string | null;
		  }
		| undefined;
	const lastIngestedAt = row?.last_ingested_at ? new Date(row.last_ingested_at).toISOString() : null;
	return {
		totalChunks: Number(row?.total_chunks ?? 0),
		contextCount: Number(row?.context_count ?? 0),
		exerciseCount: Number(row?.exercise_count ?? 0),
		embeddedCount: Number(row?.embedded_count ?? 0),
		distinctTopics: Number(row?.distinct_topics ?? 0),
		activeTopics: Number(row?.active_topics ?? 0),
		lastIngestedAt,
	};
}

export type RecentContextChunkRow = {
	id: string;
	topic_id: string;
	topic_name: string | null;
	chunk_type: string;
	content_preview: string;
	source_ref: string | null;
	has_embedding: boolean;
	created_at: string;
};

export async function listRecentContextChunks(limit = 50): Promise<RecentContextChunkRow[]> {
	const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 200);
	const res = await db.execute(sql`
		SELECT
			c.id,
			c.topic_id,
			t.topic_name,
			c.chunk_type,
			LEFT(c.content, 160) AS content_preview,
			c.source_ref,
			(c.embedding IS NOT NULL) AS has_embedding,
			c.created_at
		FROM topic_context_chunks c
		LEFT JOIN topics t ON t.id = c.topic_id
		ORDER BY c.created_at DESC
		LIMIT ${safeLimit}
	`);
	return [...res].map((r) => {
		const row = r as {
			id: string;
			topic_id: string;
			topic_name: string | null;
			chunk_type: string;
			content_preview: string | null;
			source_ref: string | null;
			has_embedding: boolean;
			created_at: Date | string;
		};
		return {
			id: String(row.id),
			topic_id: String(row.topic_id),
			topic_name: row.topic_name ?? null,
			chunk_type: String(row.chunk_type),
			content_preview: row.content_preview ?? "",
			source_ref: row.source_ref ?? null,
			has_embedding: Boolean(row.has_embedding),
			created_at: new Date(row.created_at).toISOString(),
		};
	});
}
