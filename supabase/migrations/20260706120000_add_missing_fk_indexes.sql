-- Add indexes on foreign-key columns that Supabase's performance advisor flagged
-- as unindexed (confirmed missing via pg_index on the dev source-of-truth).
-- These back RLS subquery joins and admin/portal filters; without them the
-- planner falls back to sequential scans, which degrades as data grows.
--
-- Plain (non-CONCURRENTLY) CREATE INDEX is intentional: every target table is
-- small (largest ~2.5k rows), so the build is sub-second and the brief lock is
-- imperceptible. Plain index creation also runs safely inside the single
-- transaction that `apply_migration` uses. If any of these tables ever grows
-- large, switch that statement to CREATE INDEX CONCURRENTLY and apply it
-- outside a migration transaction.
--
-- IF NOT EXISTS makes this idempotent / safe to re-run.

create index if not exists idx_parent_student_links_student_id on public.parent_student_links (student_id);
create index if not exists idx_student_answers_question_id on public.student_answers (question_id);
create index if not exists idx_performance_tracker_subject_id on public.performance_tracker (subject_id);
create index if not exists idx_test_reports_student_id on public.test_reports (student_id);
create index if not exists idx_question_flags_question_id on public.question_flags (question_id);
create index if not exists idx_question_flags_student_id on public.question_flags (student_id);
create index if not exists idx_doubt_conversations_topic_id on public.doubt_conversations (topic_id);
create index if not exists idx_assignment_questions_topic_id on public.assignment_questions (topic_id);
create index if not exists idx_notifications_sender_id on public.notifications (sender_id);
create index if not exists idx_email_log_recipient_id on public.email_log (recipient_id);
create index if not exists idx_audit_logs_user_id on public.audit_logs (user_id);
create index if not exists idx_practice_analytics_events_student_id on public.practice_analytics_events (student_id);
create index if not exists idx_coupon_redemptions_subscription_id on public.coupon_redemptions (subscription_id);
create index if not exists idx_profiles_elective_subject_id on public.profiles (elective_subject_id);
create index if not exists idx_subscriptions_plan_code on public.subscriptions (plan_code);
create index if not exists idx_subscriptions_pending_plan_code on public.subscriptions (pending_plan_code);
