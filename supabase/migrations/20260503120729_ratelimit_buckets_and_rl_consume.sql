-- Production-grade Postgres-native rate limiter.
-- Auth-agnostic (caller provides the key) so it serves admin login,
-- practice generation, doubt chat, and future hot paths without coupling
-- to auth.uid(). UNLOGGED table because rate-limit data is ephemeral —
-- losing it on crash is fine, and skipping WAL/replication makes writes
-- fast under heavy concurrency.
--
-- Applied to remote ledger as version 20260503120729 via Supabase MCP.

-- 1. Storage
create unlogged table if not exists public.rate_limit_buckets (
  key          text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (key, window_start)
);

create index if not exists rate_limit_buckets_window_idx
  on public.rate_limit_buckets (window_start);

-- Lock table down: only service_role (rate-limit pool) needs direct access.
-- The function below is SECURITY DEFINER so callers do not need table grants.
revoke all on table public.rate_limit_buckets from public;
revoke all on table public.rate_limit_buckets from authenticated;
revoke all on table public.rate_limit_buckets from anon;
grant  all on table public.rate_limit_buckets to   service_role;

-- 2. Atomic consumer
-- One round-trip, no transaction, no advisory lock. ON CONFLICT gives
-- atomicity for free. Counter is capped at p_limit_n via the WHERE clause
-- on UPDATE so a denied key under flood does not grow the counter
-- unbounded.
create or replace function public.rl_consume(
  p_key        text,
  p_limit_n    integer,
  p_window_sec integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $fn$
declare
  v_window timestamptz;
  v_count  integer;
begin
  if p_key is null or length(p_key) = 0 then
    raise exception 'p_key must be non-empty';
  end if;
  if p_limit_n is null or p_limit_n < 1 then
    raise exception 'p_limit_n must be >= 1';
  end if;
  if p_window_sec is null or p_window_sec < 1 then
    raise exception 'p_window_sec must be >= 1';
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_sec) * p_window_sec
  );

  insert into public.rate_limit_buckets (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start)
    do update set count = rate_limit_buckets.count + 1
      where rate_limit_buckets.count < p_limit_n
  returning count into v_count;

  if v_count is null then
    allowed   := false;
    remaining := 0;
    reset_at  := v_window + make_interval(secs => p_window_sec);
    return next;
    return;
  end if;

  allowed   := true;
  remaining := greatest(0, p_limit_n - v_count);
  reset_at  := v_window + make_interval(secs => p_window_sec);
  return next;
end;
$fn$;

revoke all     on function public.rl_consume(text, integer, integer) from public;
grant  execute on function public.rl_consume(text, integer, integer) to   service_role;

-- 3. GC every 10 minutes — keep the unlogged table tiny.
do $cron$
begin
  if not exists (select 1 from cron.job where jobname = 'rate-limit-gc-every-10m') then
    perform cron.schedule(
      'rate-limit-gc-every-10m',
      '*/10 * * * *',
      $cmd$delete from public.rate_limit_buckets where window_start < now() - interval '1 hour'$cmd$
    );
  end if;
end $cron$;
