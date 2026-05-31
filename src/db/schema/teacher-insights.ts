import { integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { subjects } from "./academic";
import { organizations } from "./organizations";
import { profiles } from "./profiles";

/**
 * Per-teacher cache of AI dashboard class-insight narratives. Keyed by
 * (teacher, scope, prompt_version) and validated by `dataFingerprint` — a
 * sha256 of the summary inputs that fed the prompt. NULL scope columns mean
 * "all". The actual unique index in SQL uses NULLS NOT DISTINCT so the "all"
 * scope is a single upsert target; see the migration. Source of truth for the
 * table is the SQL migration — this is kept for app-side types + parity.
 */
export const teacherClassInsights = pgTable(
	"teacher_class_insights",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		teacherId: uuid("teacher_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		organizationId: uuid("organization_id").references(() => organizations.id, {
			onDelete: "set null",
		}),
		grade: smallint("grade"),
		section: text("section"),
		subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "cascade" }),
		promptVersion: integer("prompt_version").notNull(),
		dataFingerprint: text("data_fingerprint").notNull(),
		insight: jsonb("insight").notNull(),
		model: text("model"),
		provider: text("provider"),
		servedCount: integer("served_count").notNull().default(0),
		lastServedAt: timestamp("last_served_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex("teacher_class_insights_scope_uniq").on(
			t.teacherId,
			t.grade,
			t.section,
			t.subjectId,
			t.promptVersion,
		),
	],
);
