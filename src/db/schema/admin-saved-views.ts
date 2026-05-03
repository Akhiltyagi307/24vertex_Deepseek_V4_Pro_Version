import { index, jsonb, pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

/** Per-list saved filter/sort/search presets for admin operators (single shared admin; keyed by list_id). */
export const adminSavedViews = pgTable(
	"admin_saved_views",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		listId: varchar("list_id", { length: 120 }).notNull(),
		name: varchar("name", { length: 200 }).notNull(),
		state: jsonb("state").notNull().default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [unique("admin_saved_views_list_name_uidx").on(t.listId, t.name), index("idx_admin_saved_views_list").on(t.listId)],
);
