-- Private Supabase Storage bucket for doubt-chat attachments (worksheet
-- photos + PDFs). One folder per student keyed on auth.uid() — same shape as
-- `student-test-reports`. Path layout: <auth.uid>/<conversationId>/<file>.<ext>.
--
-- Apply to BOTH Supabase projects (dev + prod) so the bucket and RLS shape
-- stay in lockstep.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'doubt-attachments',
    'doubt-attachments',
    false,
    10485760, -- 10 MiB
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'application/pdf'
    ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Tighten RLS: only the owning student can read/write their own folder.
DROP POLICY IF EXISTS "Doubt attachments select own folder" ON storage.objects;
DROP POLICY IF EXISTS "Doubt attachments insert own folder" ON storage.objects;
DROP POLICY IF EXISTS "Doubt attachments update own folder" ON storage.objects;
DROP POLICY IF EXISTS "Doubt attachments delete own folder" ON storage.objects;

CREATE POLICY "Doubt attachments select own folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'doubt-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Doubt attachments insert own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'doubt-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Doubt attachments update own folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'doubt-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'doubt-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Doubt attachments delete own folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'doubt-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

COMMIT;
