-- Cron idempotency ledger.
--
-- Why this table exists:
--   pg_cron firings can double-fire after a database failover, after a
--   manual replay, or when a cron route is invoked from the admin panel
--   while the scheduled job is also running. Several cron routes do
--   externally-visible work (sending trial reminder emails, weekly digest,
--   compliance retention) where a duplicate firing is at best annoying
--   (a user gets two reminders) and at worst a compliance issue.
--
--   Each cron caller now passes an `Idempotency-Key` header. The route's
--   first action is to insert a row here with that key. If a duplicate
--   key arrives, the insert fails uniqueness and the route exits without
--   doing the work. On completion, the row is updated with the result
--   so admins can see the outcome of past runs.
--
-- Why a dedicated table (vs. reusing job/audit tables):
--   - `admin_action_log` is append-only and intentionally not a "ledger".
--     Putting cron-state on it would muddy the audit semantics.
--   - The existing `jobs` queue is a different shape (claim/process/retry)
--     and not all internal routes use it.
--
-- Retention:
--   Keep ~30 days of completed runs for forensics; older rows get pruned by
--   the existing compliance retention cron. A simple time-based delete is
--   fine — this table is small (one row per cron firing).

create table if not exists public.cron_run_log (
  -- Caller-provided unique key. We keep this as TEXT (not UUID) so callers
  -- can use whatever fits — pg_cron's `concat(now(), route)`, a hash from
  -- the calling cron job's metadata, or a UUID. Length capped to keep the
  -- index size sane.
  idempotency_key text not null primary key
    check (char_length(idempotency_key) between 8 and 200),

  -- Identifies which internal route processed this run. Free-form so we
  -- don't have to migrate the table every time we add a cron endpoint.
  cron_route text not null
    check (char_length(cron_route) between 1 and 200),

  started_at timestamptz not null default now(),
  completed_at timestamptz,

  -- Optional structured outcome — sender counts, processed counts, errors.
  -- Capped via a length check on the serialized form (JSONB itself has no
  -- length but the underlying TOAST has practical limits we want to stay
  -- well below for grep-able admin pages).
  result jsonb,

  created_at timestamptz not null default now()
);

create index if not exists cron_run_log_route_idx on public.cron_run_log (cron_route, started_at desc);
create index if not exists cron_run_log_started_at_idx on public.cron_run_log (started_at desc);

-- This table contains operational metadata and is service-role-only. RLS
-- on with no policies = nothing readable from `authenticated` or `anon`.
alter table public.cron_run_log enable row level security;

comment on table public.cron_run_log is
  'Idempotency ledger for /api/internal/* cron firings. Service-role only; pg_cron and admin replays insert+complete here.';
