-- `enforce_coupon_single_use_global()` previously fired for every INSERT into
-- `coupon_redemptions`, ignoring `coupons.single_use_globally`. That made every
-- campaign coupon effectively single-fire globally → second student's redeem
-- raised in Postgres and surfaced as an opaque RPC error ("try again later").

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_coupon_single_use_global()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_single boolean;
BEGIN
	SELECT c.single_use_globally INTO v_single
	FROM public.coupons c
	WHERE c.id = NEW.coupon_id;

	IF coalesce(v_single, false) IS NOT TRUE THEN
		RETURN NEW;
	END IF;

	IF EXISTS (
		SELECT 1
		FROM public.coupon_redemptions cr
		WHERE cr.coupon_id = NEW.coupon_id
	) THEN
		RAISE EXCEPTION 'Coupon has already been redeemed'
			USING ERRCODE = '23505';
	END IF;
	RETURN NEW;
END;
$$;

COMMIT;
