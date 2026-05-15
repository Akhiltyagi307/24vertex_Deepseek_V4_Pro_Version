import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { authUsers } from "./auth-users";

export const organizations = pgTable(
	"organizations",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		type: varchar("type", { length: 32 }).notNull(),
		name: varchar("name", { length: 300 }).notNull(),
		externalId: varchar("external_id", { length: 100 }),
		faviconUrl: text("favicon_url"),
		/** Teacher joins must supply this code with the chosen organization (admin distributes). */
		linkingCode: varchar("linking_code", { length: 8 }).notNull(),
		isActive: boolean("is_active").notNull().default(true),
		createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_organizations_catalog").on(t.isActive, t.deletedAt, t.name),
		uniqueIndex("idx_organizations_linking_code_uidx").on(t.linkingCode),
		uniqueIndex("idx_organizations_active_type_name")
			.on(t.type, sql`lower(${t.name})`)
			.where(sql`${t.deletedAt} IS NULL`),
	],
);

export const teacherOrganizationMemberships = pgTable(
	"teacher_organization_memberships",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		teacherId: uuid("teacher_id")
			.notNull()
			.references(() => authUsers.id, { onDelete: "cascade" }),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		status: varchar("status", { length: 20 }).notNull().default("active"),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		unique().on(t.teacherId, t.organizationId),
		uniqueIndex("idx_teacher_org_memberships_one_active")
			.on(t.teacherId)
			.where(sql`${t.status} = 'active'`),
		index("idx_teacher_org_memberships_org").on(t.organizationId, t.status),
	],
);

export const teacherStudentLinks = pgTable(
	"teacher_student_links",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		teacherId: uuid("teacher_id")
			.notNull()
			.references(() => authUsers.id, { onDelete: "cascade" }),
		studentId: uuid("student_id")
			.notNull()
			.references(() => authUsers.id, { onDelete: "cascade" }),
		status: varchar("status", { length: 20 }).notNull().default("pending"),
		linkedAt: timestamp("linked_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		unique().on(t.teacherId, t.studentId),
		index("idx_teacher_student_links_teacher").on(t.teacherId, t.status),
		index("idx_teacher_student_links_student").on(t.studentId, t.status),
	],
);
