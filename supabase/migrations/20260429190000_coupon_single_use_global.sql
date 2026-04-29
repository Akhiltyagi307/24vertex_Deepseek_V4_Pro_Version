-- Enforce coupon tokens as single-use globally.
-- A coupon code may be redeemed by at most one profile.

CREATE OR REPLACE FUNCTION public.enforce_coupon_single_use_global()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trg_coupon_single_use_global ON public.coupon_redemptions;
CREATE TRIGGER trg_coupon_single_use_global
	BEFORE INSERT ON public.coupon_redemptions
	FOR EACH ROW
	EXECUTE FUNCTION public.enforce_coupon_single_use_global();
