-- Practice test report PDFs: private bucket, one folder per student (auth.uid()).
-- test_reports: storage path + optional grading failure audit fields.

ALTER TABLE public.test_reports
    ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
    ADD COLUMN IF NOT EXISTS grading_failed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS grading_error TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-test-reports',
    'student-test-reports',
    false,
    15728640,
    ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Student test reports select own folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'student-test-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Student test reports insert own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'student-test-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Student test reports update own folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'student-test-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'student-test-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Student test reports delete own folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'student-test-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
