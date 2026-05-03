import { jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const featureFlags = pgTable("feature_flags", {
	key: varchar("key", { length: 100 }).primaryKey(),
	value: jsonb("value").notNull(),
	description: text("description"),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
