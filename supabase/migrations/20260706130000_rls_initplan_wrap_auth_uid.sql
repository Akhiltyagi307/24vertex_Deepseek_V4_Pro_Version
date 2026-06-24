-- Wrap auth.<fn>() calls in RLS policies with a scalar subquery:
--   auth.uid()  ->  (select auth.uid())
-- Postgres then evaluates the auth function ONCE per statement (an InitPlan)
-- instead of once per row, fixing the `auth_rls_initplan` performance-advisor
-- findings on the hottest multi-tenant tables (profiles, tests, test_reports,
-- performance_tracker, student_answers, parent_student_links, assignments).
--
-- SEMANTICS ARE UNCHANGED: auth.uid()/auth.jwt() return the same value for the
-- whole statement, so wrapping them in (select ...) changes only WHEN they are
-- evaluated, not WHAT they return. Each policy below is dropped and recreated
-- with its command, roles, USING and WITH CHECK clauses reproduced verbatim
-- except for that wrapping. The DROP/CREATE pairs run inside the single
-- migration transaction, so other sessions never observe a policy gap.
--
-- Generated mechanically via regexp_replace over pg_policies on the dev
-- source-of-truth (ezxmjkvhrlqeimhnfvfd) — no predicates were hand-edited.

drop policy "Parents read linked child assignments" on public.assignments;
create policy "Parents read linked child assignments" on public.assignments as permissive for select to authenticated
	using ((((status)::text = 'published'::text) AND rls_parent_linked_child_has_assignment_submission(id, (select auth.uid()))));

drop policy "Students read targeted assignments" on public.assignments;
create policy "Students read targeted assignments" on public.assignments as permissive for select to authenticated
	using ((((status)::text = 'published'::text) AND rls_student_has_assignment_submission(id, (select auth.uid()))));

drop policy "Teachers read own assignments" on public.assignments;
create policy "Teachers read own assignments" on public.assignments as permissive for select to authenticated
	using (((teacher_id = (select auth.uid())) AND auth_is_verified_teacher((select auth.uid()))));

drop policy "Parents see own links" on public.parent_student_links;
create policy "Parents see own links" on public.parent_student_links as permissive for select to public
	using ((parent_id = (select auth.uid())));

drop policy "Students see links to them" on public.parent_student_links;
create policy "Students see links to them" on public.parent_student_links as permissive for select to public
	using ((student_id = (select auth.uid())));

drop policy "Parents update own links" on public.parent_student_links;
create policy "Parents update own links" on public.parent_student_links as permissive for update to public
	using ((parent_id = (select auth.uid())));

drop policy "Students update links where they are student" on public.parent_student_links;
create policy "Students update links where they are student" on public.parent_student_links as permissive for update to public
	using ((student_id = (select auth.uid())));

drop policy "Parents view linked child performance" on public.performance_tracker;
create policy "Parents view linked child performance" on public.performance_tracker as permissive for select to public
	using ((EXISTS ( SELECT 1
   FROM parent_student_links psl
  WHERE ((psl.parent_id = (select auth.uid())) AND (psl.student_id = performance_tracker.student_id) AND ((psl.status)::text = 'active'::text)))));

drop policy "Students select own performance" on public.performance_tracker;
create policy "Students select own performance" on public.performance_tracker as permissive for select to public
	using (((select auth.uid()) = student_id));

drop policy "Teachers view accessible student performance" on public.performance_tracker;
create policy "Teachers view accessible student performance" on public.performance_tracker as permissive for select to authenticated
	using (teacher_can_access_student((select auth.uid()), student_id));

drop policy "Parents can view linked children profiles" on public.profiles;
create policy "Parents can view linked children profiles" on public.profiles as permissive for select to public
	using ((EXISTS ( SELECT 1
   FROM parent_student_links psl
  WHERE ((psl.parent_id = (select auth.uid())) AND (psl.student_id = profiles.id) AND ((psl.status)::text = 'active'::text)))));

drop policy "Teachers can view accessible student profiles" on public.profiles;
create policy "Teachers can view accessible student profiles" on public.profiles as permissive for select to authenticated
	using ((((role)::text = 'student'::text) AND teacher_can_access_student((select auth.uid()), id)));

drop policy "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles as permissive for select to public
	using (((select auth.uid()) = id));

drop policy "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles as permissive for update to public
	using (((select auth.uid()) = id));

drop policy "Users manage answers via own tests" on public.student_answers;
create policy "Users manage answers via own tests" on public.student_answers as permissive for all to authenticated
	using ((EXISTS ( SELECT 1
   FROM tests t
  WHERE ((t.id = student_answers.test_id) AND (t.student_id = (select auth.uid()))))))
	with check ((EXISTS ( SELECT 1
   FROM tests t
  WHERE ((t.id = student_answers.test_id) AND (t.student_id = (select auth.uid()))))));

drop policy "Parents view linked child student answers" on public.student_answers;
create policy "Parents view linked child student answers" on public.student_answers as permissive for select to authenticated
	using ((EXISTS ( SELECT 1
   FROM (tests t
     JOIN parent_student_links psl ON ((psl.student_id = t.student_id)))
  WHERE ((t.id = student_answers.test_id) AND (psl.parent_id = (select auth.uid())) AND ((psl.status)::text = 'active'::text)))));

drop policy "Verified teachers select answers for assigned tests" on public.student_answers;
create policy "Verified teachers select answers for assigned tests" on public.student_answers as permissive for select to authenticated
	using ((EXISTS ( SELECT 1
   FROM ((tests t
     JOIN assignment_submissions s ON (((s.student_id = t.student_id) AND ((s.test_id = t.id) OR (t.assignment_submission_id = s.id)))))
     JOIN assignments a ON ((a.id = s.assignment_id)))
  WHERE ((t.id = student_answers.test_id) AND (a.teacher_id = (select auth.uid())) AND auth_is_verified_teacher((select auth.uid()))))));

drop policy "Students manage own test reports" on public.test_reports;
create policy "Students manage own test reports" on public.test_reports as permissive for all to public
	using (((select auth.uid()) = student_id));

drop policy "Parents view linked child test reports" on public.test_reports;
create policy "Parents view linked child test reports" on public.test_reports as permissive for select to public
	using ((EXISTS ( SELECT 1
   FROM parent_student_links psl
  WHERE ((psl.parent_id = (select auth.uid())) AND (psl.student_id = test_reports.student_id) AND ((psl.status)::text = 'active'::text)))));

drop policy "Verified teachers select reports for assigned tests" on public.test_reports;
create policy "Verified teachers select reports for assigned tests" on public.test_reports as permissive for select to authenticated
	using ((EXISTS ( SELECT 1
   FROM ((tests t
     JOIN assignment_submissions s ON (((s.student_id = t.student_id) AND ((s.test_id = t.id) OR (t.assignment_submission_id = s.id)))))
     JOIN assignments a ON ((a.id = s.assignment_id)))
  WHERE ((t.id = test_reports.test_id) AND (test_reports.student_id = t.student_id) AND (a.teacher_id = (select auth.uid())) AND auth_is_verified_teacher((select auth.uid()))))));

drop policy "Students manage own tests" on public.tests;
create policy "Students manage own tests" on public.tests as permissive for all to authenticated
	using (((select auth.uid()) = student_id))
	with check (((select auth.uid()) = student_id));

drop policy "Parents view linked child tests" on public.tests;
create policy "Parents view linked child tests" on public.tests as permissive for select to public
	using ((EXISTS ( SELECT 1
   FROM parent_student_links psl
  WHERE ((psl.parent_id = (select auth.uid())) AND (psl.student_id = tests.student_id) AND ((psl.status)::text = 'active'::text)))));

drop policy "Students view own tests" on public.tests;
create policy "Students view own tests" on public.tests as permissive for select to public
	using (((select auth.uid()) = student_id));

drop policy "Verified teachers select assignment-linked tests" on public.tests;
create policy "Verified teachers select assignment-linked tests" on public.tests as permissive for select to authenticated
	using ((EXISTS ( SELECT 1
   FROM (assignment_submissions s
     JOIN assignments a ON ((a.id = s.assignment_id)))
  WHERE ((a.teacher_id = (select auth.uid())) AND auth_is_verified_teacher((select auth.uid())) AND (s.student_id = tests.student_id) AND ((s.test_id = tests.id) OR (tests.assignment_submission_id = s.id))))));
