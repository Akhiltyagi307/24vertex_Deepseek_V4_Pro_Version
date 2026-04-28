-- Allow parents (active parent_student_links) to read linked students' billing rows
-- so entitlement snapshots, payment history, and plan status work in the parent portal.

BEGIN;

CREATE POLICY "subscriptions_select_linked_student"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.parent_student_links psl
      WHERE psl.parent_id = auth.uid()
        AND psl.student_id = subscriptions.profile_id
        AND psl.status = 'active'
    )
  );

CREATE POLICY "usage_periods_select_linked_student"
  ON public.usage_periods
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.parent_student_links psl
      WHERE psl.parent_id = auth.uid()
        AND psl.student_id = usage_periods.profile_id
        AND psl.status = 'active'
    )
  );

CREATE POLICY "payments_select_linked_student"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.parent_student_links psl
      WHERE psl.parent_id = auth.uid()
        AND psl.student_id = payments.profile_id
        AND psl.status = 'active'
    )
  );

COMMIT;
