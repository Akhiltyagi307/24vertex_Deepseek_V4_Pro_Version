-- Structured saga-state ledger for compliance_requests.
--
-- Why a dedicated table:
--   The freeform `compliance_requests.notes` append pattern in
--   `src/lib/compliance/erasure.ts:appendDsrNote` is human-readable but
--   not aggregatable. A compliance officer asked "how many erasures
--   failed at auth_pseudonymize last quarter?" cannot answer that
--   without grep-style scanning across hundreds of notes blobs.
--   This table records every saga transition as a row so the answer
--   is a SQL group-by.
--
-- Compatibility:
--   `notes` stays. `appendDsrNote` continues to write there. Both writes
--   happen until admin UIs migrate to query the new table; a later
--   cleanup PR removes the shim.
--
-- Phases (free-form text by design — new sagas add new phases):
--   erasure: saga_started, db_transaction, auth_pseudonymize
--   export:  build, upload
--   identity_verification: identity_verification
--
-- Statuses:
--   started  — phase began
--   ok       — phase completed successfully
--   failed   — phase failed (error_message and/or payload should explain)
--   skipped  — phase intentionally skipped (e.g. dry_run)
--
-- This migration is idempotent (`if not exists`) so it's safe to
-- re-apply on either project ledger.

create table if not exists public.compliance_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.compliance_requests(id) on delete cascade,
  phase text not null check (char_length(phase) between 1 and 80),
  status text not null check (status in ('started', 'ok', 'failed', 'skipped')),
  error_message text check (char_length(error_message) <= 2000),
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists compliance_request_events_request_id_idx
  on public.compliance_request_events (request_id, created_at);
create index if not exists compliance_request_events_phase_status_idx
  on public.compliance_request_events (phase, status, created_at desc);
create index if not exists compliance_request_events_created_at_idx
  on public.compliance_request_events (created_at desc);

-- Service-role only. Operators query via the SQL console; admin UIs
-- must go through a backend route handler that performs the read.
alter table public.compliance_request_events enable row level security;

comment on table public.compliance_request_events is
  'Per-phase events for compliance saga execution (erasure, export, identity verification). Replaces the freeform compliance_requests.notes append pattern.';
