-- Historical repair SQL (applied to production main 2026-05-03): align
-- supabase_migrations.schema_migrations.version for rows whose `name` exists on
-- both dev and main (singleton), to dev template versions. Do not re-run blindly; PK must stay unique.

BEGIN;

UPDATE supabase_migrations.schema_migrations
SET version = version || '__eduai_sync_tmp'
WHERE version IN ('20260412170141', '20260412170342', '20260412201413', '20260412201422', '20260503134218', '20260503140421', '20260413182220', '20260413182617', '20260413183005', '20260503134300', '20260413190922', '20260413191045', '20260413191233', '20260413192744', '20260413192925', '20260413193332', '20260503134930', '20260503134346', '20260419183112', '20260419101752', '20260419183329', '20260419183333', '20260419183334', '20260419183335', '20260419201136', '20260419211607', '20260422063152', '20260423083533', '20260423110846', '20260423110930', '20260503135438', '20260429143113', '20260423190737', '20260503135401', '20260503134404', '20260425184610', '20260425175805', '20260427192506', '20260427192520', '20260427192535', '20260503140006', '20260503140020', '20260503134458', '20260428071641', '20260428175910', '20260428214956', '20260503134530', '20260503135417', '20260503134953', '20260503135008', '20260503135023', '20260503135037', '20260429143012', '20260429143038', '20260429143142', '20260501113844', '20260501122832', '20260503140910', '20260503141350', '20260503141026', '20260503141008', '20260503141056', '20260503141143', '20260503141222', '20260503141253', '20260503141336', '20260502130933', '20260502164010', '20260503141743', '20260503141814', '20260503162159', '20260503184841', '20260503184854', '20260503190827', '20260503190902', '20260503194133', '20260503142309');

UPDATE supabase_migrations.schema_migrations AS t
SET version = v.new_version::text
FROM (VALUES
  ('eduai_pdr_v3_core','20260412000001'),
  ('eduai_audit_logs_explicit_deny','20260412000003'),
  ('sync_student_parent_is_verified_with_email','20260413120000'),
  ('fix_profiles_select_rls_recursion','20260413140000'),
  ('profiles_bio_phone_website','20260413150000'),
  ('student_avatars_storage','20260414100000'),
  ('commerce_with_maths_stream','20260414120000'),
  ('science_pcmb_stream','20260414130000'),
  ('science_pcm_stream','20260414140000'),
  ('science_pcb_stream','20260414150000'),
  ('grade12_science_pcmb_subjects','20260415100000'),
  ('grade12_science_pcm_subjects','20260415110000'),
  ('grade12_science_pcb_subjects','20260415120000'),
  ('grade12_commerce_with_maths_subjects','20260415130000'),
  ('grade12_commerce_subjects','20260415140000'),
  ('grade12_commerce_with_maths_mathematics_two_parts','20260415150000'),
  ('sync_student_performance_tracker','20260418120000'),
  ('grade_9_10_english_split_social_science','20260418140000'),
  ('student_answers_unique_test_question','20260419120000'),
  ('student_test_reports_storage','20260419140000'),
  ('practice_jobs','20260419210000'),
  ('practice_append_questions','20260419220000'),
  ('practice_abandon_test','20260419230000'),
  ('practice_observability','20260419240000'),
  ('fix_practice_subject_progress_ambiguous_test_id','20260419240100'),
  ('fix_practice_start_grading_return_types','20260420100000'),
  ('practice_question_types_fill_long','20260420120000'),
  ('doubt_chat','20260422120000'),
  ('saas_billing','20260423000001'),
  ('saas_billing_admin_only_rls','20260423000002'),
  ('billing_consume_current_period','20260423100000'),
  ('free_trial_once_per_identity','20260423110000'),
  ('get_entitlement_snapshot','20260424120000'),
  ('signup_batch_rpcs','20260424150000'),
  ('topic_context_chunks_reconcile','20260425150000'),
  ('student_answers_ai_report_summaries','20260426120000'),
  ('practice_reclaim_stale_running_jobs','20260426200000'),
  ('practice_generate_test_bulk_insert','20260428100000'),
  ('practice_upsert_question_embeddings','20260428101000'),
  ('practice_update_trackers_bulk','20260428102000'),
  ('parent_billing_select_linked_student','20260428200000'),
  ('parent_doubt_read_linked_student','20260428201000'),
  ('allow_anon_read_active_subjects_v2','20260429083830'),
  ('link_parent_when_student_has_no_parent_email','20260429120000'),
  ('practice_jobs_pg_cron','20260429123000'),
  ('security_billing_profiles_links_flags','20260429143000'),
  ('allow_anon_read_active_subjects','20260429151000'),
  ('normalize_get_student_subjects_rpc_signature','20260429161000'),
  ('profiles_curriculum_auto_sync_performance_tracker','20260429172000'),
  ('fix_tracker_sync_stream_type_cast','20260429173500'),
  ('restore_initialize_performance_tracker_function','20260429174500'),
  ('restore_performance_tracker_unique_constraint','20260429175500'),
  ('billing_redeem_coupon_atomic','20260429180500'),
  ('coupon_single_use_global','20260429190000'),
  ('reclaim_stale_free_trial_claims','20260429200000'),
  ('doubt_messages_tutor_mode','20260501113839'),
  ('link_parent_email_from_auth_users','20260501122849'),
  ('20260502120000_admin_panel_phase1','20260501192323'),
  ('profiles_grade_stream_index','20260501215226'),
  ('admin_phase2_saved_views','20260501215245'),
  ('admin_panel_phase1','20260501220113'),
  ('admin_runtime_kv_and_login_rate','20260502112023'),
  ('admin_phase3_assessments_live','20260502112049'),
  ('admin_phase5_communications_ai','20260502112106'),
  ('admin_phase7_compliance','20260502124025'),
  ('compliance_retention_pg_cron','20260502130039'),
  ('compliance_retention_2am_ist','20260502130928'),
  ('internal_http_routes_pg_cron','20260502164000'),
  ('security_tier1_rls_hardening','20260503075744'),
  ('ratelimit_buckets_and_rl_consume','20260503120729'),
  ('enable_postgres_fdw','20260503162200'),
  ('compliance_exports_storage','20260503184847'),
  ('trial_emails_pg_cron','20260503184900'),
  ('phase4_billing_admin','20260503190910'),
  ('seed_free_trial_identity_blocklist','20260503190937'),
  ('coupons_checkout_kind','20260503194059'),
  ('admin_phase8_operational','20260515130000')
) AS v(name, new_version)
WHERE t.name = v.name AND t.version LIKE '%__eduai_sync_tmp';

COMMIT;
