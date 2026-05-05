-- Append-only ledger of parent-portal mutations.
--
-- Why a dedicated table (vs. reusing admin_action_log):
--   admin_action_log is RLS-protected for admin-only consumers and its
--   shape (target_type, target_id, totp_used) is admin-flavored. Mixing
--   parent rows in would muddy compliance queries that filter
--   admin-only events, and the totp_used column never applies to parent
--   actions. Structure mirrors admin_action_log so a future "unified
--   audit feed" view can UNION the two with minimal mapping.
--
-- Why a foreign key with on delete cascade:
--   When a parent's account is hard-deleted (DPDP / GDPR erasure), the
--   audit rows go with them. Other audit tables (admin_action_log,
--   audit_logs) intentionally survive deletion for compliance reasons,
--   but parent rows describe routine portal navigation and are not
--   regulator-required retention.
--
-- This migration is idempotent (`if not exists`) so it's safe to
-- re-apply on either project ledger.

create table if not exists public.parent_audit (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (char_length(action) between 1 and 100),
  target_type text check (char_length(target_type) between 0 and 50),
  target_id text check (char_length(target_id) between 0 and 200),
  payload jsonb,
  ip_address inet,
  user_agent text check (char_length(user_agent) between 0 and 500),
  created_at timestamptz not null default now()
);

create index if not exists parent_audit_parent_id_idx
  on public.parent_audit (parent_id, created_at desc);
create index if not exists parent_audit_action_idx
  on public.parent_audit (action, created_at desc);
create index if not exists parent_audit_created_at_idx
  on public.parent_audit (created_at desc);

-- Service-role only. Parents do not need read access — operators query
-- via the SQL console (which uses the service role).
alter table public.parent_audit enable row level security;

comment on table public.parent_audit is
  'Append-only audit log of parent-portal mutations. Service-role insert; no SELECT policy (operator queries only).';
