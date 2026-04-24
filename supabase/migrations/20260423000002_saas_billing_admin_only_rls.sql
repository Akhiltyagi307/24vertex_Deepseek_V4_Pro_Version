-- Explicit "admin-only" policies for billing_events and coupons.
-- Service-role bypasses RLS, so these DENY policies only bite authenticated
-- client sessions -- exactly what we want (no student should read raw
-- webhook payloads or the master coupon list).

CREATE POLICY "billing_events_admin_only" ON public.billing_events
    FOR ALL TO authenticated
    USING (FALSE)
    WITH CHECK (FALSE);

CREATE POLICY "coupons_admin_only" ON public.coupons
    FOR ALL TO authenticated
    USING (FALSE)
    WITH CHECK (FALSE);
