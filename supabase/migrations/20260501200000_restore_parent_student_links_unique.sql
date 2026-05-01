-- Restore UNIQUE(parent_id, student_id) required by link_parent_to_student INSERT ... ON CONFLICT.
-- Without it Postgres raises 42P10: no unique or exclusion constraint matching the ON CONFLICT specification.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'parent_student_links_parent_id_student_id_key'
          AND conrelid = 'public.parent_student_links'::regclass
    ) THEN
        ALTER TABLE public.parent_student_links
            ADD CONSTRAINT parent_student_links_parent_id_student_id_key
            UNIQUE (parent_id, student_id);
    END IF;
END $$;
