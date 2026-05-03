import { index, pgTable, text, timestamp, uuid, varchar, vector } from "drizzle-orm/pg-core";

export const contentBlacklist = pgTable(
	"content_blacklist",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		patternType: varchar("pattern_type", { length: 20 }).notNull(),
		pattern: text("pattern").notNull(),
		embedding: vector("embedding", { dimensions: 1536 }),
		reason: text("reason").notNull(),
		appliesTo: varchar("applies_to", { length: 30 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("idx_content_blacklist_applies").on(t.appliesTo)],
);
