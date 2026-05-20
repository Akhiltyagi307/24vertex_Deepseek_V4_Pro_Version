import { boolean, date, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const studentActivityStreaks = pgTable("student_activity_streaks", {
	studentId: uuid("student_id").primaryKey(),
	streakWeeks: integer("streak_weeks").notNull().default(0),
	currentWeekActive: boolean("current_week_active").notNull().default(false),
	lastActiveWeekStart: date("last_active_week_start"),
	longestStreakWeeks: integer("longest_streak_weeks").notNull().default(0),
	rewardGrantedAt: timestamp("reward_granted_at", { withTimezone: true }),
	rewardStreakWeeks: integer("reward_streak_weeks"),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
