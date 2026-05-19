/**
 * Shared types for the student notifications system.
 *
 * Notification rows are stored in `public.notifications` with the columns
 * defined in `src/db/schema/comms-audit.ts`. CTAs are derived from
 * `type + reference_type + reference_id + category` so no schema change is
 * required for the initial set of actions.
 */

/** Allowed values for `notifications.type` (matches the current CHECK constraint). */
export type NotificationType =
	| "test_result"
	| "announcement"
	| "reminder"
	| "alert"
	| "system"
	| "encouragement";

/** Stable slug stored in `notifications.category`. Extend as new flows land. */
export type NotificationCategory =
	| "test_report_ready"
	| "usage_tests_80"
	| "usage_tests_100"
	| "usage_tokens_80"
	| "usage_tokens_100"
	| "broadcast"
	| "onboarding"
	| "account_password_changed"
	| "account_email_changed"
	| "parent_linked_student"
	| "parent_child_link_confirmed"
	| "student_organization_linked"
	| "student_organization_unlinked"
	| "student_organization_deactivated"
	| "teacher_organization_joined"
	| "teacher_organization_left"
	| "teacher_organization_deactivated"
	| "teacher_linked_student"
	| "teacher_student_link_confirmed"
	| "assignment_published"
	| "assignment_materialized"
	| "assignment_graded";

/** Shape passed to UI components when rendering a notification row. */
export type NotificationListItem = {
	id: string;
	title: string;
	body: string;
	type: NotificationType;
	category: NotificationCategory | string | null;
	referenceType: string | null;
	referenceId: string | null;
	/** Linked student profile when this row is parent-scoped or multi-child context. */
	contextStudentId?: string | null;
	/** Resolved display name for `contextStudentId` (API-enriched). */
	relatedStudentName?: string | null;
	priority: "normal" | "urgent";
	isRead: boolean;
	createdAt: string;
};

/** Lightweight CTA descriptor derived from a notification row. */
export type NotificationCta = {
	label: string;
	href: string;
	/** `primary` gets the solid button; `secondary` renders as a link/ghost. */
	variant: "primary" | "secondary";
};

/**
 * Maps a notification row to an optional call-to-action.
 *
 * - `test_result` rows with `reference_type=test` → View report.
 * - `alert` rows whose category starts with `usage_` → View plan.
 *
 * Returning `null` leaves the card clickable (navigates to `/student/notifications`)
 * but without a dedicated button.
 */
export type NotificationPortal = "student" | "parent";

export function deriveCta(
	row: Pick<
		NotificationListItem,
		"type" | "category" | "referenceType" | "referenceId" | "contextStudentId"
	>,
	opts?: { portal?: NotificationPortal },
): NotificationCta | null {
	const portal = opts?.portal ?? "student";

	if (row.type === "test_result" && row.referenceType === "test" && row.referenceId) {
		if (portal === "parent" && row.contextStudentId) {
			const qs = new URLSearchParams({
				student: row.contextStudentId,
				test: row.referenceId,
			});
			return {
				label: "View report",
				href: `/parent/open-report?${qs.toString()}`,
				variant: "primary",
			};
		}
		return {
			label: "View report",
			href: `/student/reports?test=${encodeURIComponent(row.referenceId)}`,
			variant: "primary",
		};
	}
	if (row.type === "alert" && typeof row.category === "string" && row.category.startsWith("usage_")) {
		return {
			label: "View plan",
			href: portal === "parent" ? "/parent/subscription" : "/student/subscription",
			variant: "secondary",
		};
	}
	if (
		typeof row.category === "string" &&
		(row.category === "assignment_published" ||
			row.category === "assignment_materialized" ||
			row.category === "assignment_graded")
	) {
		return {
			label: row.category === "assignment_graded" ? "View assignment" : "Open assignments",
			href: portal === "parent" ? "/parent/assignments" : "/student/assignments",
			variant: "primary",
		};
	}
	if (
		row.type === "system" &&
		typeof row.category === "string" &&
		(row.category === "account_password_changed" ||
			row.category === "account_email_changed" ||
			row.category === "parent_linked_student" ||
			row.category === "student_organization_linked" ||
			row.category === "student_organization_unlinked" ||
			row.category === "student_organization_deactivated" ||
			row.category === "teacher_linked_student")
	) {
		return {
			label: portal === "parent" ? "Account" : "Account settings",
			href: portal === "parent" ? "/parent/settings" : "/student/settings",
			variant: "secondary",
		};
	}
	if (
		row.type === "system" &&
		(row.category === "teacher_organization_joined" ||
			row.category === "teacher_organization_left" ||
			row.category === "teacher_organization_deactivated" ||
			row.category === "teacher_student_link_confirmed")
	) {
		return {
			label: "Teacher settings",
			href: "/teacher/settings",
			variant: "secondary",
		};
	}
	if (
		portal === "parent" &&
		row.type === "system" &&
		row.category === "parent_child_link_confirmed"
	) {
		return {
			label: "Dashboard",
			href: "/parent/dashboard",
			variant: "secondary",
		};
	}
	return null;
}

/**
 * Bucket used against `user_preferences.notification_types` to gate a row.
 * Usage-threshold alerts collapse under a single `usage_alert` preference so a
 * student can opt out of all quota reminders without touching other types.
 */
export function preferenceKeyForRow(row: { type: NotificationType; category: NotificationCategory | string | null }): string {
	if (row.type === "alert" && typeof row.category === "string" && row.category.startsWith("usage_")) {
		return "usage_alert";
	}
	return row.type;
}

/**
 * Keys shown in the student notification preferences UI and accepted from the
 * client payload. The canonical Zod schema lives at
 * `@/lib/notifications/preferences-schema` and consumes this constant directly,
 * so the two no longer drift.
 */
export const NOTIFICATION_PREFERENCE_KEYS = [
	"test_result",
	"usage_alert",
	"announcement",
	"reminder",
] as const;

export type NotificationPreferenceKey = (typeof NOTIFICATION_PREFERENCE_KEYS)[number];

/**
 * Default preference map applied when a user has no `user_preferences` row yet.
 *
 * Keys must match the values returned by {@link preferenceKeyForRow}. The bare
 * `alert` key is intentionally omitted: every `type: "alert"` row in the
 * codebase is a usage-threshold row (category `usage_*`), which collapses
 * under `usage_alert` instead.
 */
export const DEFAULT_NOTIFICATION_TYPES: Record<string, boolean> = {
	test_result: true,
	announcement: true,
	reminder: true,
	usage_alert: true,
	system: true,
	encouragement: true,
};
