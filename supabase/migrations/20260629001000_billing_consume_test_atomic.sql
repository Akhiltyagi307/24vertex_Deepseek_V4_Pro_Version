-- H-2a fix: billing_consume_test had a check-then-act race that let students
-- exceed their test quota under concurrency.
--
-- The previous body (canonical: 20260521120000) put the quota predicate only
-- in the SELECT (`tests_used < tests_quota`) and then ran an UPDATE keyed on
-- `id` alone, with no FOR UPDATE lock and no re-check. Two concurrent grade/
-- consume calls for the same student could both pass the SELECT and both
-- increment, pushing tests_used past tests_quota.
--
-- Fix: fold the quota predicate into the UPDATE's WHERE clause and return
-- whether a row was actually updated (mirrors the correct atomic pattern in
-- src/lib/billing/quota-grant-consume.ts -> consumeNextQuotaTestGrant). Under
-- READ COMMITTED, a concurrent UPDATE that loses the row-lock race re-evaluates
-- the WHERE against the freshly-committed tests_used, so it is rejected once
-- the quota is reached. No FOR UPDATE needed.
--
-- billing_consume_tokens is intentionally NOT changed: it already caps with
-- LEAST(tokens_quota, tokens_used + p_tokens) inside a single UPDATE (atomic,
-- no overflow), and it must keep returning TRUE on success because the
-- doubt-chat "can start" gate is evaluated separately via the remaining-token
-- read, not via this function's return value.

CREATE OR REPLACE FUNCTION public.billing_consume_test(p_profile_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_sub_id UUID;
    v_usage_id UUID;
BEGIN
    SELECT id INTO v_sub_id FROM public.subscriptions WHERE profile_id = p_profile_id;
    IF v_sub_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT u.id INTO v_usage_id
    FROM public.usage_periods u
    WHERE u.subscription_id = v_sub_id
      AND u.period_start <= NOW()
      AND u.period_end > NOW()
      AND u.tests_used < u.tests_quota
    ORDER BY u.period_end DESC
    LIMIT 1;

    IF v_usage_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.usage_periods
    SET tests_used = tests_used + 1
    WHERE id = v_usage_id
      AND tests_used < tests_quota;

    -- FALSE when the row was consumed to quota by a concurrent txn between our
    -- SELECT and UPDATE (the WHERE no longer matches) -> caller treats as
    -- quota exhausted, no over-count.
    RETURN FOUND;
END;
$function$;
