import {
	boolean,
	index,
	integer,
	numeric,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const aiPrompts = pgTable(
	"ai_prompts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		feature: varchar("feature", { length: 64 }).notNull(),
		name: varchar("name", { length: 200 }).notNull(),
		version: integer("version").notNull(),
		template: text("template").notNull(),
		model: varchar("model", { length: 64 }).notNull(),
		temperature: numeric("temperature", { precision: 3, scale: 2 }),
		maxTokens: integer("max_tokens"),
		isActive: boolean("is_active").notNull().default(false),
		notes: text("notes"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		unique("ai_prompts_feature_version_uq").on(t.feature, t.version),
		index("idx_ai_prompts_active").on(t.feature),
	],
);
