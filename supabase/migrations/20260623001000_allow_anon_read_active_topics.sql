-- Allow anon SELECT on active topic rows so server-side caches that run
-- without request cookies (notably `getCachedTopicCountsBySubjectForGrade`
-- inside `unstable_cache`) can read topic counts at the lowest privilege.
--
-- Previously the cache used a service-role client just because there was no
-- request cookie to drive the request-scoped auth client. Service-role
-- bypasses RLS — overkill for a public, anon-readable aggregate. This
-- policy mirrors the equivalent rule on `public.subjects` (active only).
--
-- `is_active = TRUE` filters out drafts and retired topics so anon clients
-- can't enumerate work-in-progress curriculum.

DROP POLICY IF EXISTS "Topics are readable by all anon users (active only)" ON public.topics;

CREATE POLICY "Topics are readable by all anon users (active only)"
ON public.topics
FOR SELECT
TO anon
USING (is_active = TRUE);
