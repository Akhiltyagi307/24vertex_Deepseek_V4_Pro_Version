-- Idempotency-key foundation for student-initiated test generation
-- (review finding H2 — durable generation, increment 1a: SCHEMA ONLY, no
-- behavior change yet).
--
-- The streaming generate flow carries no idempotency key. If the function
-- persists the test AND consumes the credit but the response/stream is then lost
-- (client disconnect, edge timeout on the response), the student's retry runs the
-- whole pipeline again -> a second test row + a second credit consumed. This
-- column lets a retry that carries the same client_request_id resolve to the
-- original test instead of duplicating, and it is the dedup key the durable
-- generation job will key on.
--
-- This migration ONLY adds the column + a partial unique index. NULLs are allowed
-- for every existing row and any caller that doesn't pass a key, so it is inert
-- and safe to apply ahead of the code that populates/consults it (the persist
-- RPC change + route pre-check land in the next increment).
--
-- `tests` is a hot OLTP table, so the index is built CONCURRENTLY (no surrounding
-- transaction) per the CI concurrent-index lint. The unique build cannot fail on
-- existing data because every current row has client_request_id = NULL (excluded
-- by the partial WHERE).
--
-- Apply identically to BOTH Supabase projects (canary + main).

ALTER TABLE public.tests
	ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_tests_student_client_request_id
	ON public.tests (student_id, client_request_id)
	WHERE client_request_id IS NOT NULL;
