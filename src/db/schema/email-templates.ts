import { boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

export const emailTemplates = pgTable(
	"email_templates",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		slug: varchar("slug", { length: 100 }).notNull(),
		version: integer("version").notNull(),
		subjectTmpl: text("subject_tmpl").notNull(),
		bodyMjml: text("body_mjml").notNull(),
		bodyHtml: text("body_html").notNull(),
		variables: jsonb("variables").notNull(),
		isActive: boolean("is_active").notNull().default(false),
		notes: text("notes"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		unique("email_templates_slug_version_uq").on(t.slug, t.version),
		index("idx_email_templates_slug").on(t.slug),
	],
);
