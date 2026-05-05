-- Partial unique index that enforces email dedup at the database level.
--
-- Why this exists:
--   `sendHtmlEmailLogged` already had a "dedupKey" feature: callers pass a
--   key, the function queries `email_log` for a matching row in `('sent',
--   'queued')` status, and skips if found. That worked for sequential calls
--   but not for race conditions: two concurrent calls could both query
--   before either inserts and end up sending the same email twice.
--
--   The fix is a partial unique index: PostgreSQL refuses the second insert
--   atomically. The TypeScript layer can rely on this for a real ON CONFLICT
--   DO NOTHING and stop racing on read-then-insert.
--
-- Index shape:
--   - `template` is the email template slug ("trial-ending", "broadcast",
--     etc.) — already a stable column.
--   - `dedup_key` lives inside the JSONB `provider_payload->>'dedup_key'`.
--     Indexing a JSON expression is fine; PG materializes the result.
--   - WHERE clause restricts to in-flight or successfully-sent rows. A
--     prior failed attempt (status='failed') does NOT block a retry, which
--     is the correct semantics — the previous send didn't actually go out.
--   - WHERE also filters NULL keys: rows without dedup intent (most
--     transactional emails) are unaffected by the index, so the dedup
--     feature stays opt-in at the call site.
--
-- This migration is idempotent (`if not exists`) so it's safe to re-apply
-- on either project ledger.
create unique index if not exists email_log_dedup_unique_idx
  on public.email_log (template, ((provider_payload->>'dedup_key')))
  where status in ('sent', 'queued')
    and (provider_payload->>'dedup_key') is not null;

comment on index public.email_log_dedup_unique_idx is
  'Enforces (template, dedup_key) uniqueness for in-flight or sent rows; replaces a read-then-insert race in sendHtmlEmailLogged.';
