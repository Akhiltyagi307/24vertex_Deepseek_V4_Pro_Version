import { index, integer, numeric, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { aiPrompts } from "./ai-prompts";
import { tests } from "./assessment";
import { practiceGenerationRuns } from "./practice-tables";

export const aiCalls = pgTable(
	"ai_calls",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		feature: varchar("feature", { length: 64 }).notNull(),
		model: varchar("model", { length: 64 }).notNull(),
		userId: uuid("user_id"),
		promptId: uuid("prompt_id").references(() => aiPrompts.id, { onDelete: "set null" }),
		generationRunId: uuid("generation_run_id").references(() => practiceGenerationRuns.id, {
			onDelete: "set null",
		}),
		correlationId: uuid("correlation_id"),
		testId: uuid("test_id").references(() => tests.id, { onDelete: "set null" }),
		stepKey: varchar("step_key", { length: 64 }),
		inputTokens: integer("input_tokens").notNull(),
		outputTokens: integer("output_tokens").notNull(),
		reasoningTokens: integer("reasoning_tokens"),
		cacheHitTokens: integer("cache_hit_tokens"),
		cacheMissTokens: integer("cache_miss_tokens"),
		provider: varchar("provider", { length: 32 }),
		latencyMs: integer("latency_ms"),
		status: varchar("status", { length: 20 }).notNull(),
		error: text("error"),
		costInr: numeric("cost_inr", { precision: 12, scale: 4 }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_ai_calls_feature_created").on(t.feature, t.createdAt),
		index("idx_ai_calls_user").on(t.userId),
		index("idx_ai_calls_generation_run_created").on(t.generationRunId, t.createdAt),
		index("idx_ai_calls_test_created").on(t.testId, t.createdAt),
		index("idx_ai_calls_correlation_created").on(t.correlationId, t.createdAt),
		index("idx_ai_calls_step_key_created").on(t.stepKey, t.createdAt),
		index("idx_ai_calls_provider_created").on(t.provider, t.createdAt),
	],
);
