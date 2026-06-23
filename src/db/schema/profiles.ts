import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { subjects } from "./academic";
import { organizations } from "./organizations";

export const profiles = pgTable(
	"profiles",
	{
		id: uuid("id").primaryKey(),
		fullName: varchar("full_name", { length: 200 }).notNull(),
		role: varchar("role", { length: 20 }).notNull(),
		grade: integer("grade"),
		section: varchar("section", { length: 5 }),
		stream: varchar("stream", { length: 50 }),
		electiveSubjectId: uuid("elective_subject_id").references(() => subjects.id),
		schoolName: varchar("school_name", { length: 300 }),
		parentName: varchar("parent_name", { length: 200 }),
		parentEmail: varchar("parent_email", { length: 320 }),
		// L-2: 8 to match 20260619100000_extend_student_link_code_to_8_chars.sql
		// (live column is varchar(8) for the XXX12345 format). Leaving this at 6
		// would make a Drizzle push try to truncate the column.
		studentLinkCode: varchar("student_link_code", { length: 8 }),
		bio: text("bio"),
		phone: varchar("phone", { length: 32 }),
		website: varchar("website", { length: 500 }),
		subjectsTaught: uuid("subjects_taught").array(),
		avatarUrl: text("avatar_url"),
		organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
		isVerified: boolean("is_verified").default(false),
		lastActiveAt: timestamp("last_active_at"),
		isSuspended: boolean("is_suspended").notNull().default(false),
		suspendedReason: text("suspended_reason"),
		suspendedAt: timestamp("suspended_at", { withTimezone: true }),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		// Cross-device "dismissed the first-run welcome" marker (NULL = not yet seen).
		onboardingWelcomeSeenAt: timestamp("onboarding_welcome_seen_at", { withTimezone: true }),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(t) => [
		index("idx_profiles_role").on(t.role),
		index("idx_profiles_grade_section").on(t.grade, t.section),
		index("idx_profiles_stream").on(t.stream),
		index("idx_profiles_organization").on(t.organizationId),
	],
);

export const parentStudentLinks = pgTable(
	"parent_student_links",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		parentId: uuid("parent_id").notNull(),
		studentId: uuid("student_id").notNull(),
		status: varchar("status", { length: 20 }).default("pending"),
		linkedAt: timestamp("linked_at"),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(t) => [
		unique().on(t.parentId, t.studentId),
		index("idx_parent_links_parent").on(t.parentId),
		index("idx_parent_links_student").on(t.studentId),
	],
);
