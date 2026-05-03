-- Phase 3: live test ops, admin messages, test credit refund RPC, dashboard stuck_webhooks fix,
-- admin_runtime_kv JSON for bulk job progress.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) tests: live session + pause accounting (PDR §4.28)
-- ---------------------------------------------------------------------------
ALTER TABLE public.tests
	ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT FALSE,
	ADD COLUMN IF NOT EXISTS admin_extensions INTEGER NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(64),
	ADD COLUMN IF NOT EXISTS last_ip VARCHAR(45),
	ADD COLUMN IF NOT EXISTS tab_blur_count INTEGER NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS accumulated_pause_seconds INTEGER NOT NULL DEFAULT 0;

-- Live admin grid (PDR): validate with e.g.
--   EXPLAIN ANALYZE
--   SELECT id, student_id, subject_id, status, updated_at, time_limit_seconds, is_paused
--   FROM public.tests
--   WHERE status = 'in_progress' AND updated_at > NOW() - INTERVAL '5 minutes';
-- Expect btree scan on idx_tests_status_updated (status, updated_at DESC).
CREATE INDEX IF NOT EXISTS idx_tests_status_updated ON public.tests (status, updated_at DESC);

-- ---------------------------------------------------------------------------
-- 2) admin_test_messages (operator → student in-session)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_test_messages (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	test_id UUID NOT NULL REFERENCES public.tests (id) ON DELETE CASCADE,
	body TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_test_messages_test_created ON public.admin_test_messages (test_id, created_at DESC);

ALTER TABLE public.admin_test_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_test_messages_select_own_test"
	ON public.admin_test_messages FOR SELECT TO authenticated
	USING (
		EXISTS (
			SELECT 1 FROM public.tests t
			WHERE t.id = admin_test_messages.test_id AND t.student_id = auth.uid()
		)
	);

REVOKE ALL ON TABLE public.admin_test_messages FROM PUBLIC;
GRANT SELECT ON TABLE public.admin_test_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.admin_test_messages TO service_role;

-- ---------------------------------------------------------------------------
-- 3) admin_runtime_kv: JSON payload for bulk job progress (service_role only)
-- ---------------------------------------------------------------------------
ALTER TABLE public.admin_runtime_kv
	ADD COLUMN IF NOT EXISTS value_json JSONB;

-- ---------------------------------------------------------------------------
-- 4) billing_refund_test — mirror billing_consume_test window; service_role or owner/parent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.billing_refund_test(p_profile_id UUID, p_amount INT DEFAULT 1)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_sub_id UUID;
	v_usage_id UUID;
	v_tests_used INT;
	v_dec INT;
BEGIN
	IF p_amount IS NULL OR p_amount < 1 THEN
		RETURN FALSE;
	END IF;

	IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
		IF auth.uid() IS NULL THEN
			RAISE EXCEPTION 'billing_refund_test: not authenticated' USING ERRCODE = '42501';
		END IF;
		IF auth.uid() IS DISTINCT FROM p_profile_id
			AND NOT EXISTS (
				SELECT 1 FROM public.parent_student_links psl
				WHERE psl.student_id = p_profile_id
				  AND psl.parent_id = auth.uid()
				  AND psl.status = 'active'
			)
		THEN
			RAISE EXCEPTION 'billing_refund_test: forbidden' USING ERRCODE = '42501';
		END IF;
	END IF;

	SELECT id INTO v_sub_id FROM public.subscriptions WHERE profile_id = p_profile_id;
	IF v_sub_id IS NULL THEN
		RETURN FALSE;
	END IF;

	SELECT u.id INTO v_usage_id
	FROM public.usage_periods u
	WHERE u.subscription_id = v_sub_id
	  AND u.period_start <= NOW()
	  AND u.period_end > NOW()
	  AND u.tests_used > 0
	ORDER BY u.period_end DESC
	LIMIT 1;

	IF v_usage_id IS NULL THEN
		RETURN FALSE;
	END IF;

	SELECT tests_used INTO v_tests_used FROM public.usage_periods WHERE id = v_usage_id;
	v_dec := LEAST(p_amount, v_tests_used);
	IF v_dec < 1 THEN
		RETURN FALSE;
	END IF;

	UPDATE public.usage_periods
	SET tests_used = tests_used - v_dec
	WHERE id = v_usage_id;

	RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.billing_refund_test(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_refund_test(UUID, INT) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Atomic admin refund + billing_events (idempotent via razorpay_event_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_refund_test_credit_event(
	p_profile_id UUID,
	p_amount INT,
	p_synthetic_event_id VARCHAR(120),
	p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_dedupe BOOLEAN;
	v_refund_ok BOOLEAN;
BEGIN
	IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
		RAISE EXCEPTION 'admin_refund_test_credit_event: service_role only' USING ERRCODE = '42501';
	END IF;

	IF p_synthetic_event_id IS NULL OR length(p_synthetic_event_id) < 8 THEN
		RETURN jsonb_build_object('ok', false, 'error', 'invalid_synthetic_event_id');
	END IF;

	PERFORM pg_advisory_xact_lock(hashtext(p_synthetic_event_id::text));

	SELECT EXISTS (
		SELECT 1 FROM public.billing_events WHERE razorpay_event_id = p_synthetic_event_id
	) INTO v_dedupe;

	IF v_dedupe THEN
		RETURN jsonb_build_object('ok', true, 'deduped', true);
	END IF;

	v_refund_ok := public.billing_refund_test(p_profile_id, p_amount);

	IF NOT v_refund_ok THEN
		RETURN jsonb_build_object('ok', false, 'error', 'nothing_to_refund');
	END IF;

	INSERT INTO public.billing_events (razorpay_event_id, event_type, payload, processed_at)
	VALUES (p_synthetic_event_id, 'admin_refund_credit', p_payload, NOW());

	RETURN jsonb_build_object('ok', true, 'deduped', false);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_refund_test_credit_event(UUID, INT, VARCHAR, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_refund_test_credit_event(UUID, INT, VARCHAR, JSONB) TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Dashboard mat view: stuck_webhooks excludes admin_* events
-- ---------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.admin_dashboard_metrics;

CREATE MATERIALIZED VIEW public.admin_dashboard_metrics AS
SELECT
	(SELECT COUNT(*)::bigint FROM public.profiles WHERE role = 'student' AND deleted_at IS NULL) AS total_students,
	(SELECT COUNT(*)::bigint FROM public.profiles WHERE last_active_at > NOW() - INTERVAL '24 hours') AS active_24h,
	(SELECT COUNT(*)::bigint FROM public.tests WHERE status = 'submitted' AND (created_at::date = CURRENT_DATE)) AS tests_submitted_today,
	(SELECT COUNT(*)::bigint FROM public.tests WHERE status = 'in_progress') AS tests_in_progress,
	(SELECT COUNT(*)::bigint FROM public.subscriptions WHERE status = 'active') AS active_subscriptions,
	(
		SELECT COALESCE(
			(SELECT COUNT(*)::bigint FROM public.subscriptions WHERE status = 'active' AND plan_code = 'pro_monthly') * 1000
			+ (SELECT COUNT(*)::bigint FROM public.subscriptions WHERE status = 'active' AND plan_code = 'pro_annual') * 833,
			0::bigint
		)
	) AS mrr_inr,
	(SELECT COUNT(*)::bigint FROM public.profiles WHERE role = 'teacher' AND COALESCE(is_verified, FALSE) = FALSE) AS pending_teacher_approvals,
	(
		SELECT COUNT(*)::bigint FROM public.billing_events
		WHERE processed_at IS NULL
		  AND created_at < NOW() - INTERVAL '5 minutes'
		  AND event_type NOT LIKE 'admin\_%' ESCAPE '\'
	) AS stuck_webhooks,
	NOW() AS computed_at;

CREATE UNIQUE INDEX IF NOT EXISTS admin_dashboard_metrics_computed_at_key ON public.admin_dashboard_metrics (computed_at);

GRANT SELECT ON public.admin_dashboard_metrics TO service_role;

-- Admin / workers: enqueue grade jobs and re-sync tracker rows (no public EXECUTE before).
GRANT EXECUTE ON FUNCTION public.practice_enqueue_job(TEXT, UUID, JSONB, TIMESTAMP) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_student_performance_tracker_for_student(UUID, BOOLEAN) TO service_role;

COMMIT;
