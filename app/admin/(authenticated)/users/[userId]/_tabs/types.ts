import type { InferSelectModel } from "drizzle-orm";

import type { adminListPerformanceRows } from "@/lib/admin/performance-admin";
import type { adminListTests } from "@/lib/admin/tests-admin";
import type {
	adminListAssignmentSubmissionsForStudent,
	adminListAssignmentsForTeacher,
	adminListLinkedStudentsForParent,
	adminListNotificationsForUser,
} from "@/lib/admin/user-detail-lists";
import type { adminGetUserById } from "@/lib/admin/users-list";
import type { complianceRequests } from "@/db/schema/compliance-requests";

/**
 * D16: shared types for the per-tab components under
 * `app/admin/(authenticated)/users/[userId]/_tabs/`. Pulling them here keeps
 * the dispatcher page small and the tab files independently typeable.
 */

export const USER_DETAIL_TABS = [
	"profile",
	"performance",
	"tests",
	"assignments",
	"notifications",
	"sessions",
	"audit",
	"compliance",
] as const;

export type UserDetailTab = (typeof USER_DETAIL_TABS)[number];

export type UserDetailRow = NonNullable<Awaited<ReturnType<typeof adminGetUserById>>>;
export type LinkedStudent = Awaited<ReturnType<typeof adminListLinkedStudentsForParent>>[number];
export type TestsList = Awaited<ReturnType<typeof adminListTests>>;
export type StudentAssignments = Awaited<
	ReturnType<typeof adminListAssignmentSubmissionsForStudent>
>;
export type TeacherAssignments = Awaited<
	ReturnType<typeof adminListAssignmentsForTeacher>
>;
export type NotificationsList = Awaited<ReturnType<typeof adminListNotificationsForUser>>;
export type PerformanceRow = Awaited<ReturnType<typeof adminListPerformanceRows>>[number];
export type ComplianceRow = InferSelectModel<typeof complianceRequests>;

export interface UserDetailStats {
	performanceTrackerRows: number;
}

export interface UserTabPaginationState {
	page: number;
	pageSize: number;
}
