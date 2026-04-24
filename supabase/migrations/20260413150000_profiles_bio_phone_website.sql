-- Optional student-facing profile fields (editable on /student/settings).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT,
    ADD COLUMN IF NOT EXISTS phone VARCHAR(32),
    ADD COLUMN IF NOT EXISTS website VARCHAR(500);
