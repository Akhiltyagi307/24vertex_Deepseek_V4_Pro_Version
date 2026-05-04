-- Migration: advisors_remediation_search_path_and_avatars_listing
--
-- Two Supabase advisor remediations bundled into one migration so they ship
-- atomically to both Project A (suwakggcbxmmvqzeudmq) and Project B
-- (ezxmjkvhrlqeimhnfvfd).
--
-- 1. function_search_path_mutable
--    ----------------------------
--    The advisor flagged four helper functions whose search_path was
--    unset, which makes them vulnerable to schema-shadowing attacks. Pin
--    `search_path = public, pg_catalog` on each. ALTER FUNCTION ... SET is
--    idempotent and does not invalidate plans in any harmful way.
--
-- 2. public_bucket_allows_listing (avatars)
--    --------------------------------------
--    The `avatars` bucket is intentionally public so that <img> tags can
--    fetch avatar images by URL. However, the broad SELECT-on-storage
--    policy named "Avatars public read" was also allowing anonymous LIST
--    operations against the bucket, which leaks the set of user IDs that
--    have ever uploaded an avatar.
--
--    Dropping the SELECT policy stops anonymous LIST while keeping the
--    public-object endpoint
--      /storage/v1/object/public/avatars/<uid>/avatar.<ext>
--    fully working, because that route serves files via Supabase's
--    public-object service path and does not consult RLS at all.
--
--    The remaining authenticated INSERT/UPDATE/DELETE policies on
--    `avatars/<auth.uid()>/...` are untouched, so users can still manage
--    their own avatar.

ALTER FUNCTION public.normalize_trial_phone(text)
        SET search_path = public, pg_catalog;

ALTER FUNCTION public.normalize_trial_email(text)
        SET search_path = public, pg_catalog;

ALTER FUNCTION public.block_admin_log_mutation()
        SET search_path = public, pg_catalog;

ALTER FUNCTION public.assemble_and_insert(text, uuid, text, text, jsonb)
        SET search_path = public, pg_catalog;

DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
