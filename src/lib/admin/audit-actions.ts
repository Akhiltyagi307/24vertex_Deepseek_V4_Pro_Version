import "server-only";

/**
 * Canonical names for `admin_action_log.action`.
 *
 * Every admin write that goes through `writeAdminAction` should use one of
 * these constants instead of an inline string literal. Why:
 *   - Naming drift (`payment_refund` vs `paymentRefund` vs `refund_payment`)
 *     made building a queryable audit dashboard guesswork.
 *   - String literals can't be grep'd reliably; renames silently fork.
 *   - `as const` here lets us derive a union type so the TS compiler refuses
 *     unknown action names at the call site.
 *
 * Naming convention is `{resource}_{verb}` in snake_case. Failures get a
 * `_failed` suffix when both attempt and outcome are auditable.
 *
 * Adding a new action: add the constant in the right group, keep the literal
 * value in snake_case, and prefer extending an existing prefix over inventing
 * a new domain.
 */
export const ADMIN_ACTIONS = {
	// Authentication & session lifecycle
	LOGIN: "login",
	LOGIN_FAILED: "login_failed",
	LOGOUT: "logout",
	ADMIN_SESSION_REVOKE: "admin_session_revoke",
	ADMIN_SESSIONS_REVOKE_OTHERS: "admin_sessions_revoke_others",
	PANIC_REVOKE_ALL: "panic_revoke_all",
	IMPERSONATE: "impersonate",

	// User management
	USER_SOFT_DELETE: "user_soft_delete",
	USER_HARD_DELETE_REQUEST: "user_hard_delete_request",
	USER_HARD_DELETE_DONE: "user_hard_delete_done",
	USER_SUSPEND: "user_suspend",
	USER_UNSUSPEND: "user_unsuspend",

	// Teachers
	TEACHER_APPROVE: "teacher_approve",
	TEACHER_REJECT: "teacher_reject",
	TEACHER_REQUEST_INFO: "teacher_request_info",

	// Subjects
	SUBJECT_CREATE: "subject_create",
	SUBJECT_UPDATE: "subject_update",
	SUBJECT_SOFT_DELETE: "subject_soft_delete",
	SUBJECT_REORDER: "subject_reorder",

	// Topics
	TOPIC_CREATE: "topic_create",
	TOPIC_UPDATE: "topic_update",
	TOPIC_DELETE: "topic_delete",
	TOPIC_BULK: "topic_bulk",
	TOPIC_CLONE_TO_GRADE: "topic_clone_to_grade",

	// Tests / live exam control
	TEST_EXTEND_TIMER: "test_extend_timer",
	TEST_PAUSE: "test_pause",
	TEST_RESUME: "test_resume",
	TEST_FORCE_SUBMIT: "test_force_submit",
	TEST_VOID: "test_void",
	TEST_REGRADE: "test_regrade",
	TEST_SOFT_DELETE: "test_soft_delete",
	TEST_REFUND_CREDIT: "test_refund_credit",
	TEST_ADMIN_MESSAGE: "test_admin_message",
	TEST_ANSWER_OVERRIDE_SCORE: "test_answer_override_score",
	REFUND_TEST_CREDIT: "refund_test_credit",

	// Performance tracker
	PERFORMANCE_RECALCULATE: "performance_recalculate",
	PERFORMANCE_REINITIALIZE: "performance_reinitialize",
	PERFORMANCE_BULK_REINIT: "performance_bulk_reinit",
	PERFORMANCE_TRACKER_PATCH: "performance_tracker_patch",

	// Billing — plans / coupons / payments / subscriptions / grants
	PLAN_PATCH: "plan_patch",
	COUPON_CREATE: "coupon_create",
	COUPON_PATCH: "coupon_patch",
	COUPON_DISABLE: "coupon_disable",
	COUPON_DELETE: "coupon_delete",
	COUPON_BULK_GENERATE: "coupon_bulk_generate",
	COUPON_SYNC_RAZORPAY_OFFERS: "coupon_sync_razorpay_offers",
	COUPON_PATCH_REJECTED: "coupon_patch_rejected",
	PAYMENT_REFUND: "payment_refund",
	BILLING_EVENT_REPLAY: "billing_event_replay",
	BILLING_EVENT_REPLAY_FAILED: "billing_event_replay_failed",
	BILLING_EVENT_RESOLVE: "billing_event_resolve",
	BILLING_ACTION_FAILURE_RETRY: "billing_action_failure_retry",
	BILLING_ACTION_FAILURE_RESOLVE: "billing_action_failure_resolve",
	COUPON_AUTO_EXPIRED: "coupon_auto_expired",
	SUBSCRIPTION_COUPON_AUTO_EXPIRED: "subscription_coupon_auto_expired",
	COUPON_REDEMPTION_REFUND_ROLLBACK: "coupon_redemption_refund_rollback",
	BILLING_RECONCILIATION_RUN: "billing_reconciliation_run",
	SUBSCRIPTION_CHANGE_PLAN: "subscription_change_plan",
	SUBSCRIPTION_PAUSE: "subscription_pause",
	SUBSCRIPTION_RESUME: "subscription_resume",
	SUBSCRIPTION_DUNNING_CANCEL: "subscription_dunning_cancel",
	SUBSCRIPTION_APPLY_COUPON: "subscription_apply_coupon",
	SUBSCRIPTION_CANCEL_AT_PERIOD_END: "subscription_cancel_at_period_end",
	SUBSCRIPTION_CLEAR_CANCEL_AT_PERIOD_END: "subscription_clear_cancel_at_period_end",
	SUBSCRIPTION_CANCEL_NOW: "subscription_cancel_now",
	SUBSCRIPTION_CANCEL_NOW_RZP: "subscription_cancel_now_rzp",
	SUBSCRIPTION_CANCEL_RZP: "subscription_cancel_rzp",
	SUBSCRIPTION_FLIP_STATUS: "subscription_flip_status",
	SUBSCRIPTION_FORCE_RENEW: "subscription_force_renew",
	SUBSCRIPTION_RECOMPUTE_USAGE: "subscription_recompute_usage",
	SUBSCRIPTION_STAFF_OVERRIDE: "subscription_staff_override",
	QUOTA_GRANT_CREATE: "quota_grant_create",
	QUOTA_GRANT_DELETE: "quota_grant_delete",
	TRIAL_CLAIM_RELEASE: "trial_claim_release",

	// Comms — broadcasts, email templates, suppressions
	BROADCAST_CREATE: "broadcast_create",
	BROADCAST_SCHEDULE: "broadcast_schedule",
	BROADCAST_SEND: "broadcast_send",
	BROADCAST_TEST_SEND: "broadcast_test_send",
	EMAIL_TEMPLATE_ACTIVATE: "email_template_activate",
	EMAIL_TEMPLATE_VERSION_CREATE: "email_template_version_create",
	EMAIL_TEMPLATE_TEST_SEND: "email_template_test_send",
	EMAIL_SUPPRESSION_REMOVE: "email_suppression_remove",

	// AI prompts / context chunks
	AI_PROMPT_VERSION_CREATE: "ai_prompt_version_create",
	AI_PROMPT_ACTIVATE: "ai_prompt_activate",
	AI_EVAL_RUN_TRIGGER: "ai_eval_run_trigger",
	CONTEXT_CHUNK_CREATE: "context_chunk_create",
	CONTEXT_CHUNK_UPDATE: "context_chunk_update",
	CONTEXT_CHUNK_DELETE: "context_chunk_delete",

	// Moderation
	MODERATION_BLACKLIST_ADD: "moderation_blacklist_add",
	MODERATION_BLACKLIST_DELETE: "moderation_blacklist_delete",
	MODERATION_FLAG_RESOLVE: "moderation_flag_resolve",
	IDENTITY_BLOCKLIST_UPSERT: "identity_blocklist_upsert",

	// Compliance / DPDP
	COMPLIANCE_REQUEST_CREATED: "compliance_request_created",
	COMPLIANCE_REQUEST_REJECTED: "compliance_request_rejected",
	COMPLIANCE_IDENTITY_VERIFIED: "compliance_identity_verified",
	COMPLIANCE_EXPORT_STARTED: "compliance_export_started",
	COMPLIANCE_EXPORT_READY: "compliance_export_ready",
	COMPLIANCE_EXPORT_FAILED: "compliance_export_failed",
	COMPLIANCE_ERASURE_DRY_RUN: "compliance_erasure_dry_run",
	COMPLIANCE_ERASURE_COMMIT: "compliance_erasure_commit",
	PARENTAL_CONSENT_RERREQUEST_SENT: "parental_consent_rerequest_sent",
	PARENTAL_CONSENT_REVOKED: "parental_consent_revoked",
	RETENTION_POLICY_UPDATED: "retention_policy_updated",
	RETENTION_PURGE_DRY_RUN: "retention_purge_dry_run",
	RETENTION_PURGE_COMMIT: "retention_purge_commit",

	// System ops — jobs, integrity, health, SQL console, analytics
	OPERATOR_JOB_CANCEL: "operator_job_cancel",
	OPERATOR_JOB_RETRY: "operator_job_retry",
	OPERATOR_QUEUE_PAUSE: "operator_queue_pause",
	OPERATOR_QUEUE_RESUME: "operator_queue_resume",
	INTEGRITY_CHECK_RUN: "integrity_check_run",
	INTEGRITY_CHECK_FIX: "integrity_check_fix",
	SERVICE_HEALTH_CHECK: "service_health_check",
	SQL_CONSOLE_EXECUTE: "sql_console_execute",
	SQL_CONSOLE_EXECUTE_WRITE: "sql_console_execute_write",
	ANALYTICS_EXPORT: "analytics_export",
	SAVED_VIEW_DELETE: "saved_view_delete",
} as const;

export type AdminActionName = (typeof ADMIN_ACTIONS)[keyof typeof ADMIN_ACTIONS];

/**
 * Runtime-checkable union — useful for tests that scan source files for
 * stale literal action names that no longer have a constant. Membership is
 * O(1) since this is a Set built once at module load.
 */
export const ADMIN_ACTION_NAMES: ReadonlySet<AdminActionName> = new Set<AdminActionName>(
	Object.values(ADMIN_ACTIONS),
);

export function isKnownAdminAction(name: string): name is AdminActionName {
	return ADMIN_ACTION_NAMES.has(name as AdminActionName);
}
