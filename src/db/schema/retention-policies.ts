import { boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const retentionPolicies = pgTable("retention_policies", {
	entity: varchar("entity", { length: 100 }).primaryKey(),
	ttlDays: integer("ttl_days").notNull(),
	enabled: boolean("enabled").notNull().default(false),
	lastPurge: timestamp("last_purge", { withTimezone: true }),
});
