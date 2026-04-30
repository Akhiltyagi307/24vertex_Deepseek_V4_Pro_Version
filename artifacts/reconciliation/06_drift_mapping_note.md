# Supabase Dev Reconciliation Drift Mapping

Date: 2026-04-29

Source of truth in this run: live Supabase dev database migration ledger.

## Timestamp drift pairs (same logical migration names)

- Local-only file: `20260429172000_profiles_curriculum_auto_sync_performance_tracker.sql`
  - DB-applied canonical: `20260429112406_profiles_curriculum_auto_sync_performance_tracker.sql`
- Local-only file: `20260429173500_fix_tracker_sync_stream_type_cast.sql`
  - DB-applied canonical: `20260429112445_fix_tracker_sync_stream_type_cast.sql`
- Local-only file: `20260429174500_restore_initialize_performance_tracker_function.sql`
  - DB-applied canonical: `20260429112508_restore_initialize_performance_tracker_function.sql`
- Local-only file: `20260429175500_restore_performance_tracker_unique_constraint.sql`
  - DB-applied canonical: `20260429112547_restore_performance_tracker_unique_constraint.sql`

Decision: keep the DB-applied canonical timestamps in repo migration history and retire timestamp-duplicate local files.
