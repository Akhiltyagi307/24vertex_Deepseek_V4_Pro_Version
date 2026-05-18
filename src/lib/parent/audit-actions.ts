import "server-only";

/**
 * Canonical names for `parent_audit.action`.
 *
 * Mirror of `src/lib/admin/audit-actions.ts` — same convention (snake_case
 * literal), same as-const + derived union, same predicate. Adding a new
 * parent-side action: extend an existing prefix where possible
 * (`select_student_*`, `link_child_*`) rather than inventing a new domain.
 */
export const PARENT_ACTIONS = {
	// Linking
	LINK_CHILD_REQUEST: "link_child_request",
	LINK_CHILD_FAILED: "link_child_failed",
	LINK_CHILD_SUCCESS: "link_child_success",
	LINK_CHILD_THROTTLED: "link_child_throttled",
	UNLINK_CHILD: "unlink_child",

	// Active student selection
	SELECT_STUDENT: "select_student",
	SELECT_STUDENT_UNAUTHORIZED: "select_student_unauthorized",

	// Settings
	NOTIFICATION_PREFS_UPDATE: "notification_prefs_update",

	// Subscriptions (when parent acts on behalf of a linked student)
	SUBSCRIPTION_CANCEL: "subscription_cancel",
	SUBSCRIPTION_REACTIVATE: "subscription_reactivate",

	// Reports
	REPORT_DOWNLOAD: "report_download",
	REPORT_OPENED: "report_opened",
} as const;

export type ParentActionName = (typeof PARENT_ACTIONS)[keyof typeof PARENT_ACTIONS];

export const PARENT_ACTION_NAMES: ReadonlySet<ParentActionName> = new Set<ParentActionName>(
	Object.values(PARENT_ACTIONS),
);

export function isKnownParentAction(name: string): name is ParentActionName {
	return PARENT_ACTION_NAMES.has(name as ParentActionName);
}
