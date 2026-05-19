import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { profiles } from "./profiles";

export const teacherApprovalHistory = pgTable(
	"teacher_approval_history",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		teacherUserId: uuid("teacher_user_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		action: text("action").notNull(),
		actorAdminId: uuid("actor_admin_id"),
		reason: text("reason"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("teacher_approval_history_teacher_user_id_idx").on(t.teacherUserId, t.createdAt),
	],
);

export type TeacherApprovalAction = "verified" | "unverified" | "rejected";
