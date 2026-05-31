-- Composite indexes for the notification bell's hot read paths. The bell sits
-- on every authenticated page, so these queries run constantly:
--   listNotificationsForRecipient (src/lib/notifications/student-queries.ts):
--     WHERE recipient_id = ? [AND is_read = false] ORDER BY created_at DESC LIMIT n
--   getStudentUnreadCount:
--     WHERE recipient_id = ? AND is_read = false
--
-- The pre-existing indexes — (recipient_id, is_read) and (created_at) — can't
-- serve the per-recipient `ORDER BY created_at DESC` from a single index, so
-- Postgres filters by recipient then sorts the matched rows. These composites
-- make the list query an ordered index scan and cover the unread count.
--
-- CREATE INDEX CONCURRENTLY (no surrounding transaction block) so the build
-- takes SHARE UPDATE EXCLUSIVE and doesn't block writes on this hot table —
-- same pattern as 20260623003000_qna_logs_indexes_concurrent.sql.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notif_recipient_created
ON public.notifications (recipient_id, created_at DESC);

-- Partial index for the unread list + unread-badge count. Smaller than a full
-- index because most historical notifications are already read.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notif_recipient_unread_created
ON public.notifications (recipient_id, created_at DESC)
WHERE is_read = false;
