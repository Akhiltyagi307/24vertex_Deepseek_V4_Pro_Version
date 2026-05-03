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
		studentLinkCode: varchar("student_link_code", { length: 6 }),
		bio: text("bio"),
		phone: varchar("phone", { length: 32 }),
		website: varchar("website", { length: 500 }),
		subjectsTaught: uuid("subjects_taught").array(),
		avatarUrl: text("avatar_url"),
		isVerified: boolean("is_verified").default(false),
		lastActiveAt: timestamp("last_active_at"),
		isSuspended: boolean("is_suspended").notNull().default(false),
		suspendedReason: text("suspended_reason"),
		suspendedAt: timestamp("suspended_at", { withTimezone: true }),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(t) => [
		index("idx_profiles_role").on(t.role),
		index("idx_profiles_grade_section").on(t.grade, t.section),
		index("idx_profiles_stream").on(t.stream),
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
