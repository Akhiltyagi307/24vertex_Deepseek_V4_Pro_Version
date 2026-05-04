-- Sync the live Postgres default for `user_preferences.notification_types`
-- with the code-side default in `src/lib/notifications/types.ts`
-- (`DEFAULT_NOTIFICATION_TYPES`).
--
-- Apply this migration IDENTICALLY to BOTH Supabase projects:
--   • Project A — suwakgg…
--   • Project B — ezxmjk…
--
-- Behaviour
--   The runtime always merges this default with whatever the user has saved
--   (see `getNotificationPrefs` in `src/lib/notifications/prefs.ts`), so users
--   who already have a `user_preferences` row are unaffected. The column-level
--   default only matters for brand-new INSERTs that omit `notification_types`.
--
-- Notes
--   • The bare `alert` key is intentionally absent: every `type: "alert"` row
--     in the codebase is a usage-threshold row that collapses under
--     `usage_alert` via `preferenceKeyForRow`.
--   • Idempotent — re-running this is a no-op once the new default is in place.

ALTER TABLE public.user_preferences
ALTER COLUMN notification_types
SET DEFAULT '{
  "test_result": true,
  "announcement": true,
  "reminder": true,
  "usage_alert": true,
  "system": true,
  "encouragement": true
}'::jsonb;

COMMENT ON COLUMN public.user_preferences.notification_types IS
  'Per-type notification opt-ins. Keys must match preferenceKeyForRow() in src/lib/notifications/types.ts. Runtime merges this default with the user-saved JSON; missing keys are treated as opted-in.';
