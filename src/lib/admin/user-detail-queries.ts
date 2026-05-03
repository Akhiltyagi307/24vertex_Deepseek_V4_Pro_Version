import "server-only";

import { count, eq } from "drizzle-orm";

import { performanceTracker, tests } from "@/db/schema/assessment";
import { notifications } from "@/db/schema/comms-audit";
import { assignmentSubmissions, assignments } from "@/db/schema/teaching";
import { db } from "@/db";

export type AdminUserDetailStats = {
	testsCount: number;
	assignmentSubmissionsCount: number;
	assignmentsCreatedCount: number;
	notificationsCount: number;
	performanceTrackerRows: number;
};

export async function getAdminUserDetailStats(userId: string, role: string): Promise<AdminUserDetailStats> {
	const empty: AdminUserDetailStats = {
		testsCount: 0,
		assignmentSubmissionsCount: 0,
		assignmentsCreatedCount: 0,
		notificationsCount: 0,
		performanceTrackerRows: 0,
	};

	const [notifRow] = await db
		.select({ c: count() })
		.from(notifications)
		.where(eq(notifications.recipientId, userId));
	const notificationsCount = Number(notifRow?.c ?? 0);

	if (role === "student") {
		const [tRow] = await db.select({ c: count() }).from(tests).where(eq(tests.studentId, userId));
		const [subRow] = await db
			.select({ c: count() })
			.from(assignmentSubmissions)
			.where(eq(assignmentSubmissions.studentId, userId));
		const [pRow] = await db
			.select({ c: count() })
			.from(performanceTracker)
			.where(eq(performanceTracker.studentId, userId));
		return {
			...empty,
			notificationsCount,
			testsCount: Number(tRow?.c ?? 0),
			assignmentSubmissionsCount: Number(subRow?.c ?? 0),
			performanceTrackerRows: Number(pRow?.c ?? 0),
		};
	}

	if (role === "teacher") {
		const [aRow] = await db.select({ c: count() }).from(assignments).where(eq(assignments.teacherId, userId));
		return {
			...empty,
			notificationsCount,
			assignmentsCreatedCount: Number(aRow?.c ?? 0),
		};
	}

	// parent / other: notifications only for now
	return { ...empty, notificationsCount };
}
