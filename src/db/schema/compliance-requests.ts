import { boolean, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { profiles } from "./profiles";

export const complianceRequests = pgTable(
	"compliance_requests",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		requestType: varchar("request_type", { length: 30 }).notNull(),
		subjectUserId: uuid("subject_user_id").references(() => profiles.id, { onDelete: "set null" }),
		subjectEmail: varchar("subject_email", { length: 320 }),
		requesterEmail: varchar("requester_email", { length: 320 }).notNull(),
		requesterRelation: varchar("requester_relation", { length: 30 }).notNull(),
		legalBasis: varchar("legal_basis", { length: 50 }).notNull(),
		identityVerified: boolean("identity_verified").notNull().default(false),
		status: varchar("status", { length: 20 }).notNull().default("open"),
		notes: text("notes"),
		fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
		evidenceUrl: text("evidence_url"),
		dueAt: timestamp("due_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_compliance_requests_status_due").on(t.status, t.dueAt),
		index("idx_compliance_requests_subject_user").on(t.subjectUserId),
		index("idx_compliance_requests_created").on(t.createdAt),
	],
);
