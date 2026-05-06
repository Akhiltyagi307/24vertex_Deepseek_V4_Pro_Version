-- W3.3 — billing reconciliation table + daily cron schedule.
--
-- Razorpay does NOT expose an event-replay API. If our webhook endpoint is
-- unavailable for >24h, missed events are gone forever. This nightly job
-- diffs local state against Razorpay for active subscriptions and pending
-- refund idempotency rows, writing drift rows that admins can investigate
-- and fix from the admin Reconciliation page.
--
-- Schedule: 02:30 UTC daily = 08:00 IST. Off-peak so a long sync doesn't
-- compete with practice-jobs (every minute) or admin business hours.

BEGIN;

CREATE TABLE IF NOT EXISTS public.billing_reconciliation_drift (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
	payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
	idempotency_key TEXT,
	field TEXT NOT NULL,
	local_value TEXT,
	razorpay_value TEXT,
	detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	resolved_at TIMESTAMPTZ,
	resolved_by_jti TEXT,
	resolution_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_billing_reconciliation_drift_open
	ON public.billing_reconciliation_drift (detected_at DESC)
	WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_billing_reconciliation_drift_subscription
	ON public.billing_reconciliation_drift (subscription_id, detected_at DESC)
	WHERE subscription_id IS NOT NULL;

ALTER TABLE public.billing_reconciliation_drift ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS billing_reconciliation_drift_no_anon ON public.billing_reconciliation_drift;
CREATE POLICY billing_reconciliation_drift_no_anon
	ON public.billing_reconciliation_drift
	FOR ALL TO authenticated, anon
	USING (false) WITH CHECK (false);

COMMENT ON TABLE public.billing_reconciliation_drift IS
	'Per-field drift between our DB and Razorpay, captured by the W3.3 daily reconciliation cron. Resolved rows kept for audit.';

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

DO $$
BEGIN
	PERFORM cron.unschedule('billing-reconcile-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
	'billing-reconcile-daily',
	'30 2 * * *',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/billing/reconcile',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
				'Idempotency-Key', concat('billing-reconcile-', to_char(date_trunc('day', now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD'))
			),
			body := '{}'::jsonb
		);
	$cron$
);

COMMIT;
