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
	/**
	 * Emitted once per pipeline run with the call counts so we can chart
	 * "% one-shot" over time and watch repair-pass spend. Props:
	 *   {
	 *     generation_calls: number,           // 1 = best case
	 *     repair_calls: number,                // 0 = best case
	 *     succeeded_on_call: number | null,    // 1 = one-shot, null = failed
	 *     prompt_revision: string,             // e.g. "v4"
	 *     outcome: "ok" | "generation_failed" | "generation_invalid",
	 *   }
	 */
	| "practice_generation_attempts"
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
	| "upgrade_clicked"
	// Doubt-chat off-topic pre-check fired (behind DOUBT_SCOPE_PRECHECK flag).
	// Props: { code, user_tokens, vocab_size, subject_id, topic_id }.
	| "doubt_chat_off_topic_blocked";

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
