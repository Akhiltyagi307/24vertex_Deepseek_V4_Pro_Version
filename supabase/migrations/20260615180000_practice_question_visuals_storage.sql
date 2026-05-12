-- Private bucket for AI-generated practice question illustrations (OpenAI Images).
-- Paths: <student_user_id>/<slug>.png — same ownership pattern as student-test-reports.
-- Generation uploads via service role; students read via RLS SELECT on own folder.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'practice-question-visuals',
    'practice-question-visuals',
    false,
    5242880,
    ARRAY['image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Practice question visuals select own folder" ON storage.objects;
DROP POLICY IF EXISTS "Practice question visuals insert own folder" ON storage.objects;
DROP POLICY IF EXISTS "Practice question visuals update own folder" ON storage.objects;
DROP POLICY IF EXISTS "Practice question visuals delete own folder" ON storage.objects;

CREATE POLICY "Practice question visuals select own folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'practice-question-visuals'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Practice question visuals insert own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'practice-question-visuals'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Practice question visuals update own folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'practice-question-visuals'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'practice-question-visuals'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Practice question visuals delete own folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'practice-question-visuals'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

COMMIT;
