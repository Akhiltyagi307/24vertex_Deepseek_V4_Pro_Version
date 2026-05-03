import { inet, integer, pgTable, timestamp } from "drizzle-orm/pg-core";

export const adminLoginRate = pgTable("admin_login_rate", {
	ip: inet("ip").primaryKey(),
	failCount: integer("fail_count").notNull().default(0),
	windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
});
