-- Single round trip for student entitlements: subscription + chosen usage_period row.
-- Usage row rule matches app + billing_consume: prefer period_start <= now() < period_end,
-- tie-break by longest period_end; otherwise latest period_end (parity with getEntitlements fallback).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_entitlement_snapshot(p_profile_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  SELECT json_build_object(
      'subscription_id', s.id,
      'profile_id', s.profile_id,
      'plan_code', s.plan_code,
      'status', s.status,
      'trial_ends_at', s.trial_ends_at,
      'current_period_start', s.current_period_start,
      'current_period_end', s.current_period_end,
      'cancel_at_period_end', s.cancel_at_period_end,
      'razorpay_subscription_id', s.razorpay_subscription_id,
      'razorpay_customer_id', s.razorpay_customer_id,
      'pending_plan_code', s.pending_plan_code,
      'staff_override', s.staff_override,
      'tests_quota', COALESCE(u.tests_quota, 0),
      'tests_used', COALESCE(u.tests_used, 0),
      'tokens_quota', COALESCE(u.tokens_quota, 0),
      'tokens_used', COALESCE(u.tokens_used, 0)
    )
  FROM public.subscriptions s
  LEFT JOIN LATERAL (
    SELECT u.tests_quota, u.tests_used, u.tokens_quota, u.tokens_used
    FROM public.usage_periods u
    WHERE u.subscription_id = s.id
    ORDER BY
      CASE WHEN u.period_start <= NOW() AND u.period_end > NOW() THEN 0 ELSE 1 END,
      u.period_end DESC
    LIMIT 1
  ) u ON TRUE
  WHERE s.profile_id = p_profile_id;
$$;

COMMENT ON FUNCTION public.get_entitlement_snapshot(uuid) IS
  'Subscription + active (or latest) usage_period for entitlements; SECURITY INVOKER so RLS applies.';

GRANT EXECUTE ON FUNCTION public.get_entitlement_snapshot(uuid) TO authenticated, service_role;

COMMIT;
