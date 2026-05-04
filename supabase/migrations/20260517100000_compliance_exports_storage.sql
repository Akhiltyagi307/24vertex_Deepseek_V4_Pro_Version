-- DSR (Data Subject Request) export ZIPs for the compliance admin flow.
-- Private bucket; only the service role writes (admin export route) and
-- reads (signed URL minting). No RLS policies for end users — by default
-- storage.objects denies anything that isn't covered by a policy, which
-- is exactly what we want here.
--
-- Used by:
--   app/api/admin/compliance/requests/[id]/export/route.ts
--   src/lib/env.ts → getComplianceExportsBucket()  (defaults to 'compliance-exports')

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'compliance-exports',
    'compliance-exports',
    false,
    524288000, -- 500 MiB; DSR ZIP can include attachments and PDF reports
    ARRAY['application/zip']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
