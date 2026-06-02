-- Idempotency guard for `assignment_graded` in-app notifications (review M3).
--
-- Re-running a grade job (manual retry, or a concurrent double-run before the
-- fencing guard in 20260705000200 lands) re-invokes notifyAssignmentGraded(),
-- which inserts an `assignment_graded` bell card for the student AND each linked
-- parent. Only `test_report_ready` had a uniqueness guard
-- (uq_notifications_test_report_ready_recipient_ref, 20260612133000);
-- `assignment_graded` did not, so those cards could duplicate and double-ping
-- parents.
--
-- insertInAppNotification() already issues ON CONFLICT DO NOTHING (with no
-- target, so it covers ANY partial unique index on the table), so adding this
-- index makes the assignment-graded path idempotent with NO code change.
--
-- We de-duplicate any pre-existing rows FIRST (keeping the earliest per
-- recipient+submission) so the UNIQUE index build cannot fail on historical
-- duplicates. Done in a single transaction so an in-flight re-grade cannot slip
-- a new duplicate in between the cleanup and the index build.
--
-- `notifications` is intentionally NOT in the CONCURRENTLY hot-table lint list
-- (check-migration-drift.mjs), and this mirrors the in-transaction pattern of
-- the existing report-ready dedup index.
--
-- Apply identically to BOTH Supabase projects (canary + main).

BEGIN;

-- 1) Collapse historical duplicates, keeping the earliest card per
--    (recipient_id, reference_id) for the assignment_graded category.
DELETE FROM public.notifications n
USING public.notifications keep
WHERE n.category = 'assignment_graded'
  AND n.reference_type = 'assignment_submission'
  AND n.reference_id IS NOT NULL
  AND keep.category = 'assignment_graded'
  AND keep.reference_type = 'assignment_submission'
  AND keep.recipient_id = n.recipient_id
  AND keep.reference_id = n.reference_id
  AND (keep.created_at < n.created_at
       OR (keep.created_at = n.created_at AND keep.id < n.id));

-- 2) Enforce one assignment_graded card per recipient + submission going forward.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_assignment_graded_recipient_ref
	ON public.notifications (recipient_id, reference_type, reference_id, category)
	WHERE category = 'assignment_graded'
	  AND reference_type = 'assignment_submission'
	  AND reference_id IS NOT NULL;

COMMIT;
