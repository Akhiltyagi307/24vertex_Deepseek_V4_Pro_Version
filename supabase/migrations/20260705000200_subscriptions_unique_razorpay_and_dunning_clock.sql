-- Subscriptions: enforce the 1:1 Razorpay mapping the webhook assumes, and give
-- dunning a dedicated clock unrelated writes can't reset (review H3a + H3c).
--
-- H3a: razorpay_subscription_id had no uniqueness guard, but the webhook resolves
--   the local row via .eq(razorpay_subscription_id).maybeSingle(). A duplicate
--   would make maybeSingle() throw, 500 the webhook, and Razorpay would retry
--   forever — every billing event for that customer permanently stuck. Partial
--   unique index (NULLs allowed: free/trial subs carry no Razorpay id). We fail
--   loudly if duplicates already exist rather than silently deleting billing rows.
--
-- H3c: dunning hard-cancel (run-dunning) measured age from updated_at, which any
--   write resets (pause/resume/coupon/admin edit), so a non-paying sub could dodge
--   the T+14 auto-cancel indefinitely. dunning_started_at is set when the sub
--   ENTERS grace/past_due and cleared on recovery to active, so the clock is
--   stable. Nullable; legacy rows fall back to updated_at in run-dunning.
--
-- Apply identically to BOTH Supabase projects (canary + main).

BEGIN;

ALTER TABLE public.subscriptions
	ADD COLUMN IF NOT EXISTS dunning_started_at timestamptz;

DO $$
DECLARE
	dup_count int;
BEGIN
	SELECT count(*) INTO dup_count FROM (
		SELECT razorpay_subscription_id
		FROM public.subscriptions
		WHERE razorpay_subscription_id IS NOT NULL
		GROUP BY razorpay_subscription_id
		HAVING count(*) > 1
	) d;
	IF dup_count > 0 THEN
		RAISE EXCEPTION 'Cannot add unique index: % duplicated razorpay_subscription_id value(s). Resolve duplicate subscriptions rows first.', dup_count;
	END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_razorpay_subscription_id
	ON public.subscriptions (razorpay_subscription_id)
	WHERE razorpay_subscription_id IS NOT NULL;

COMMIT;
