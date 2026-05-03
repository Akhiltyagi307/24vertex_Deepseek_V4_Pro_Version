import { bigint, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const adminRuntimeKv = pgTable("admin_runtime_kv", {
	key: text("key").primaryKey(),
	valueInt: bigint("value_int", { mode: "number" }).notNull().default(0),
	valueJson: jsonb("value_json"),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
