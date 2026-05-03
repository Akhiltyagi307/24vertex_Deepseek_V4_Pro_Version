import { index, jsonb, pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";

import { topics } from "./academic";

export const topicContextChunks = pgTable(
	"topic_context_chunks",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		topicId: uuid("topic_id")
			.notNull()
			.references(() => topics.id, { onDelete: "cascade" }),
		content: text("content").notNull(),
		chunkType: text("chunk_type").notNull(),
		sourceRef: text("source_ref"),
		metadata: jsonb("metadata").notNull().default({}),
		embedding: vector("embedding", { dimensions: 1536 }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [
		index("idx_topic_context_chunks_topic_type").on(t.topicId, t.chunkType),
		index("idx_topic_context_chunks_topic_created").on(t.topicId, t.createdAt),
	],
);
