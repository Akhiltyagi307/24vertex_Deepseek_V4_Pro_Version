import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { profiles } from "./profiles";

export const parentalConsents = pgTable(
	"parental_consents",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		studentId: uuid("student_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		parentId: uuid("parent_id").references(() => profiles.id, { onDelete: "set null" }),
		parentEmail: varchar("parent_email", { length: 320 }).notNull(),
		consentMethod: varchar("consent_method", { length: 30 }).notNull(),
		consentTextV: varchar("consent_text_v", { length: 20 }).notNull(),
		grantedAt: timestamp("granted_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		evidenceUrl: text("evidence_url"),
	},
	(t) => [
		index("idx_parental_consents_student").on(t.studentId),
		index("idx_parental_consents_parent_email").on(t.parentEmail),
	],
);
