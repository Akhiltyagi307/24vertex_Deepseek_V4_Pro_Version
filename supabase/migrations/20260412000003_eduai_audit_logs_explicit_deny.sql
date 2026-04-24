-- Explicit deny for authenticated on audit_logs (service role bypasses RLS)
CREATE POLICY "No direct access to audit logs for authenticated"
ON public.audit_logs FOR ALL TO authenticated
USING (false)
WITH CHECK (false);
