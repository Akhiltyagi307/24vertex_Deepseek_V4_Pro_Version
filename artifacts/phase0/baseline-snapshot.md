# Phase 0 baseline snapshot — 2026-05-03

Project: **EDU_AI** (`suwakggcbxmmvqzeudmq`), Postgres 17.6.1.105, region ap-southeast-2.

## Baseline test/build status

- `pnpm install --frozen-lockfile` — ok
- `pnpm lint` — **0 errors, 26 warnings** (all pre-existing: `<img>` tags, unused imports). Acceptable.
- `pnpm test` — **3 failures, 145 pass, 2 skipped** in `src/lib/doubt/__tests__/doubt-helpers.test.ts`. Root cause: `docs/explain-mode-prompt.md` and related prompt template docs are missing from this branch (`docs/` dir is empty). Pre-existing baseline failure, not in scope of this work. **Do NOT count as regression.**
- `pnpm build` — exit 0 ✅

## Migration ledger (top 30 of 82 applied)

```
20260515130000  admin_phase8_operational
20260503075744  security_tier1_rls_hardening
20260502164000  internal_http_routes_pg_cron
20260502130928  compliance_retention_2am_ist
20260502130039  compliance_retention_pg_cron
20260502124025  admin_phase7_compliance
20260502112106  admin_phase5_communications_ai
20260502112049  admin_phase3_assessments_live
20260502112023  admin_runtime_kv_and_login_rate
20260501220113  admin_panel_phase1
20260501215245  admin_phase2_saved_views
20260501215226  profiles_grade_stream_index
20260501192323  20260502120000_admin_panel_phase1   ← drift (filename embedded as ledger name)
20260501163604  restore_parent_student_links_unique
20260501122849  link_parent_email_from_auth_users
20260501113839  doubt_messages_tutor_mode
20260429200000  reclaim_stale_free_trial_claims
20260429190000  coupon_single_use_global
20260429180500  billing_redeem_coupon_atomic
20260429175500  restore_performance_tracker_unique_constraint
20260429174500  restore_initialize_performance_tracker_function
20260429173500  fix_tracker_sync_stream_type_cast
20260429172000  profiles_curriculum_auto_sync_performance_tracker
20260429161000  normalize_get_student_subjects_rpc_signature
20260429152000  fix_profiles_select_policy_recursion_again
20260429151000  allow_anon_read_active_subjects
20260429150500  seed_senior_electives
20260429143000  security_billing_profiles_links_flags
20260429123000  practice_jobs_pg_cron
20260429120000  link_parent_when_student_has_no_parent_email
```

## Existing pg_cron jobs (9 active)

```
1   * * * * *      practice-run-jobs-every-minute
2   * * * * *      practice-auto-submit-expired-every-minute
4   * * * * *      refresh-admin-dashboard-metrics
6   30 20 * * *    compliance-retention-daily
12  */5 * * * *    operator-process-jobs-every-5m
13  15 */2 * * *   operator-health-pings-every-2h
14  0 4 * * *      operator-integrity-checks-daily
15  15 2 * * *     practice-metrics-daily
16  30 3 * * 1     admin-weekly-digest-monday
```

My rate-limit GC job will be #10, named `rate-limit-gc-every-10m`.

## Existing rate-limit infra

- RPC: `public.practice_rate_limit_consume(p_bucket text, p_limit_n int, p_window_seconds int)` — body in `practice_rate_limit_consume.sql`. Requires `auth.uid()`.
- Table: `public.practice_rate_limits(student_id, bucket, window_start, count)` — composite PK.
- Admin login: separate table `public.admin_login_rate` (not RPC-driven).

My new generic `public.rl_consume(p_key text, p_limit_n int, p_window_sec int)` is auth-agnostic so it can serve all paths (admin login, practice, doubt-chat, future). Old `practice_rate_limit_consume` stays in place; gets dropped in Phase 6.4 cleanup after a soak period.

## Billing events table

- 0 rows total. Adding `UNIQUE(razorpay_event_id)` constraint in Phase 2.1 is safe — no dedup migration needed.

## Existing `cost_inr` column

- `ai_calls.cost_inr numeric` exists. Phase 1.6 just changes the app code that hardcodes `null` at insert.
