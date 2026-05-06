import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Practice funnel / lifecycle events.
 * Kept as a string union so TS flags typos and the DB stays consistent.
 */
export type PracticeEvent =
	| "practice_wizard_opened"
	| "practice_subject_picked"
	| "practice_topics_picked"
	| "practice_generate_clicked"
	| "practice_generation_succeeded"
	| "practice_generation_failed"
	| "practice_session_started"
	| "practice_answer_saved"
	| "practice_submit_clicked"
	| "practice_graded"
	| "practice_grading_failed"
	| "practice_preview_regenerated"
	| "practice_auto_submitted"
	| "practice_question_flagged"
	| "practice_topic_context_truncated"
	| "practice_topic_context_empty"
	| "practice_topic_context_quality_degraded"
	// Billing / subscription funnel events (share the analytics table).
	| "subscription_mandate_authenticated"
	| "subscription_started"
	| "subscription_upgraded"
	| "subscription_cancelled"
	| "subscription_payment_failed"
	| "coupon_redeemed"
	| "paywall_shown"
	| "upgrade_clicked";

/**
 * Record a practice analytics event. Fail-silent (never blocks user action).
 * Can be called from the server (pass a Supabase client bound to the caller's
 * JWT) or from background workers (pass a service-role client).
 */
export async function recordPracticeEvent(
	supabase: SupabaseClient,
	event: PracticeEvent,
	props: Record<string, unknown> = {},
	opts: { studentId?: string | null } = {},
): Promise<void> {
	try {
		await supabase.from("practice_analytics_events").insert({
			event_name: event,
			props,
			student_id: opts.studentId ?? null,
		});
	} catch (e) {
		if (process.env.NODE_ENV === "development") {
			console.error("[recordPracticeEvent]", event, e);
		}
	}
}
