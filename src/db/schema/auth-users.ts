import { pgSchema, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Read-only Drizzle handle for the Supabase-managed `auth.users` table.
 * App code MUST NOT insert/update/delete here — Supabase Auth owns the row
 * lifecycle. Use this only to read columns we need to join with `public.profiles`
 * (e.g. the user's email for admin lists / detail views).
 *
 * Only the columns we actually read are declared; auth.users has many more.
 */
const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
	id: uuid("id").primaryKey(),
	email: varchar("email", { length: 320 }),
	createdAt: timestamp("created_at", { withTimezone: true }),
});
