import { index, integer, numeric, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { aiPrompts } from "./ai-prompts";

export const aiCalls = pgTable(
	"ai_calls",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		feature: varchar("feature", { length: 64 }).notNull(),
		model: varchar("model", { length: 64 }).notNull(),
		userId: uuid("user_id"),
		promptId: uuid("prompt_id").references(() => aiPrompts.id, { onDelete: "set null" }),
		inputTokens: integer("input_tokens").notNull(),
		outputTokens: integer("output_tokens").notNull(),
		latencyMs: integer("latency_ms"),
		status: varchar("status", { length: 20 }).notNull(),
		error: text("error"),
		costInr: numeric("cost_inr", { precision: 12, scale: 4 }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_ai_calls_feature_created").on(t.feature, t.createdAt),
		index("idx_ai_calls_user").on(t.userId),
	],
);
