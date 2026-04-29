-- Restore idempotency constraint expected by initialize_performance_tracker ON CONFLICT.
-- Safe for environments where the constraint already exists.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'performance_tracker_student_id_topic_id_key'
          AND conrelid = 'public.performance_tracker'::regclass
    ) THEN
        ALTER TABLE public.performance_tracker
            ADD CONSTRAINT performance_tracker_student_id_topic_id_key
            UNIQUE (student_id, topic_id);
    END IF;
END $$;
