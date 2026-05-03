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
