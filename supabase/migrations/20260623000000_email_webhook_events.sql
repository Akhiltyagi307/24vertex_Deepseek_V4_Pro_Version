-- Resend webhook idempotency ledger. Svix guarantees at-least-once delivery,
-- so duplicate events arrive on retry / network partition. Without dedup,
-- an out-of-order `email.delivered` retry after an `email.bounced` would
-- silently overwrite the bounced state. The route INSERTs by `svix_id` with
-- `ON CONFLICT DO NOTHING`; the absence of a returned row signals "already
-- processed, skip the email_log update."
--
-- Modelled after `public.billing_events` (Razorpay equivalent).
--
-- Service-role only by design: no end-user reads this table; operators query
-- via the admin SQL console (which uses the service role and bypasses RLS).
-- No SELECT policy on `authenticated` is declared on purpose.

BEGIN;

CREATE TABLE IF NOT EXISTS public.email_webhook_events (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	svix_id text NOT NULL UNIQUE,
	event_type varchar(80) NOT NULL,
	payload jsonb NOT NULL,
	processed_at timestamptz,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_webhook_events_type_created
	ON public.email_webhook_events (event_type, created_at DESC);

ALTER TABLE public.email_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.email_webhook_events FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.email_webhook_events TO service_role;

COMMENT ON TABLE public.email_webhook_events IS
	'Idempotency ledger for Resend webhooks (svix). Service-role only. The webhook route INSERTs ON CONFLICT (svix_id) DO NOTHING — missing returned row = already processed.';

COMMIT;
