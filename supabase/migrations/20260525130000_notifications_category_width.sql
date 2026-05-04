-- Widen `notifications.category` from varchar(30) to varchar(64).
--
-- The original column gave us only ~2 characters of headroom (the longest
-- existing category, `parent_child_link_confirmed`, is 28 chars). Newer
-- categories that may land on this code path (subscription lifecycle, future
-- compliance / engagement flows) want the same naming convention without a
-- second migration. 64 chars keeps in-app feed values short enough to display
-- and indexable as before.
--
-- Apply this migration IDENTICALLY to BOTH Supabase projects:
--   • Project A — suwakgg…
--   • Project B — ezxmjk…
--
-- Postgres treats `varchar(N)` widening as a metadata change (no rewrite),
-- so this is fast and safe to run on a live table.

ALTER TABLE public.notifications
ALTER COLUMN category TYPE varchar(64);

COMMENT ON COLUMN public.notifications.category IS
  'Stable slug for the in-app notification kind. Matches NotificationCategory in src/lib/notifications/types.ts; widened from 30 → 64 chars in 20260525130000.';
