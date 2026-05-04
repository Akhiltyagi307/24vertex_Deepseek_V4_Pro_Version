-- Parent portal notifications: optional student context on each row so parents
-- can see which linked child a notification refers to (reports, link events, etc.).

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS context_student_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.notifications.context_student_id IS
	'When set, the student profile this notification is about (e.g. parent viewing a linked child).';

CREATE INDEX IF NOT EXISTS idx_notif_context_student
ON public.notifications (context_student_id)
WHERE context_student_id IS NOT NULL;
