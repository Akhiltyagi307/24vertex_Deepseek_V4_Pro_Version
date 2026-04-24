-- RLS (PDR + gaps), registration RPCs, grants, minimal seed

-- ============================================================
-- ROW LEVEL SECURITY — PDR policies + missing tables
-- ============================================================

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subjects are readable by all authenticated users"
ON public.subjects FOR SELECT TO authenticated USING (true);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Topics are readable by all authenticated users"
ON public.topics FOR SELECT TO authenticated USING (true);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Teachers can view students in their grade/section"
ON public.profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles tp WHERE tp.id = auth.uid() AND tp.role = 'teacher')
    AND role = 'student'
    AND EXISTS (
        SELECT 1 FROM public.teacher_assignments ta
        WHERE ta.teacher_id = auth.uid()
        AND ta.grade = public.profiles.grade
        AND ta.section = public.profiles.section
    )
);
CREATE POLICY "Parents can view linked children profiles"
ON public.profiles FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.parent_student_links psl
        WHERE psl.parent_id = auth.uid()
        AND psl.student_id = public.profiles.id
        AND psl.status = 'active'
    )
);

ALTER TABLE public.performance_tracker ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students select own performance"
ON public.performance_tracker FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students insert own performance"
ON public.performance_tracker FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students update own performance"
ON public.performance_tracker FOR UPDATE USING (auth.uid() = student_id);
CREATE POLICY "Parents view linked child performance"
ON public.performance_tracker FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.parent_student_links psl
        WHERE psl.parent_id = auth.uid()
        AND psl.student_id = public.performance_tracker.student_id
        AND psl.status = 'active'
    )
);
CREATE POLICY "Teachers view students in their grade/section performance"
ON public.performance_tracker FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.teacher_assignments ta ON ta.teacher_id = auth.uid()
            AND ta.grade = p.grade AND ta.section = p.section
        WHERE p.id = public.performance_tracker.student_id
    )
);

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view own tests"
ON public.tests FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students manage own tests"
ON public.tests FOR ALL USING (auth.uid() = student_id);
CREATE POLICY "Parents view linked child tests"
ON public.tests FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.parent_student_links psl
        WHERE psl.parent_id = auth.uid()
        AND psl.student_id = public.tests.student_id
        AND psl.status = 'active'
    )
);
CREATE POLICY "Teachers view their students tests"
ON public.tests FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.teacher_assignments ta ON ta.teacher_id = auth.uid()
            AND ta.grade = p.grade AND ta.section = p.section
        WHERE p.id = public.tests.student_id
    )
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications"
ON public.notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Users update own notifications"
ON public.notifications FOR UPDATE USING (auth.uid() = recipient_id);
CREATE POLICY "Verified teachers can insert notifications"
ON public.notifications FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'teacher' AND is_verified = true
    )
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers select own assignments"
ON public.assignments FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Verified teachers insert assignments"
ON public.assignments FOR INSERT WITH CHECK (
    auth.uid() = teacher_id
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher' AND is_verified = true)
);
CREATE POLICY "Verified teachers update own assignments"
ON public.assignments FOR UPDATE USING (
    auth.uid() = teacher_id
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher' AND is_verified = true)
);
CREATE POLICY "Verified teachers delete own assignments"
ON public.assignments FOR DELETE USING (
    auth.uid() = teacher_id
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher' AND is_verified = true)
);
CREATE POLICY "Students view assignments for their grade/section"
ON public.assignments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'student'
        AND p.grade = ANY(public.assignments.target_grades)
        AND p.section = ANY(public.assignments.target_sections)
    )
    OR auth.uid() = ANY(public.assignments.target_student_ids)
);
CREATE POLICY "Parents view child assignments"
ON public.assignments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.parent_student_links psl
        JOIN public.profiles p ON p.id = psl.student_id
        WHERE psl.parent_id = auth.uid()
        AND psl.status = 'active'
        AND (p.grade = ANY(public.assignments.target_grades) AND p.section = ANY(public.assignments.target_sections))
    )
);

-- parent_student_links
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents see own links"
ON public.parent_student_links FOR SELECT USING (parent_id = auth.uid());
CREATE POLICY "Students see links to them"
ON public.parent_student_links FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Parents insert own link requests"
ON public.parent_student_links FOR INSERT WITH CHECK (parent_id = auth.uid());
CREATE POLICY "Parents update own links"
ON public.parent_student_links FOR UPDATE USING (parent_id = auth.uid());
CREATE POLICY "Students update links where they are student"
ON public.parent_student_links FOR UPDATE USING (student_id = auth.uid());

-- teacher_assignments
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own assignments rows"
ON public.teacher_assignments FOR ALL USING (teacher_id = auth.uid());

-- questions (via test ownership)
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access questions via own tests"
ON public.questions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.tests t WHERE t.id = public.questions.test_id AND t.student_id = auth.uid())
);
CREATE POLICY "Teachers read questions for student tests in scope"
ON public.questions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.tests te
        JOIN public.profiles p ON p.id = te.student_id AND p.role = 'student'
        JOIN public.teacher_assignments ta ON ta.teacher_id = auth.uid()
            AND ta.grade = p.grade AND ta.section = p.section
        WHERE te.id = public.questions.test_id
    )
);

-- student_answers
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage answers via own tests"
ON public.student_answers FOR ALL USING (
    EXISTS (SELECT 1 FROM public.tests t WHERE t.id = public.student_answers.test_id AND t.student_id = auth.uid())
);
CREATE POLICY "Teachers read answers for in-scope tests"
ON public.student_answers FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.tests te
        JOIN public.profiles p ON p.id = te.student_id AND p.role = 'student'
        JOIN public.teacher_assignments ta ON ta.teacher_id = auth.uid()
            AND ta.grade = p.grade AND ta.section = p.section
        WHERE te.id = public.student_answers.test_id
    )
);

-- test_reports
ALTER TABLE public.test_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students manage own test reports"
ON public.test_reports FOR ALL USING (auth.uid() = student_id);
CREATE POLICY "Parents view linked child test reports"
ON public.test_reports FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.parent_student_links psl
        WHERE psl.parent_id = auth.uid()
        AND psl.student_id = public.test_reports.student_id
        AND psl.status = 'active'
    )
);
CREATE POLICY "Teachers view test reports for in-scope students"
ON public.test_reports FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.teacher_assignments ta ON ta.teacher_id = auth.uid()
            AND ta.grade = p.grade AND ta.section = p.section
        WHERE p.id = public.test_reports.student_id
    )
);

-- assignment_submissions
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students manage own submissions"
ON public.assignment_submissions FOR ALL USING (auth.uid() = student_id);
CREATE POLICY "Teachers view submissions for own assignments"
ON public.assignment_submissions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.assignments a
        WHERE a.id = public.assignment_submissions.assignment_id AND a.teacher_id = auth.uid()
    )
);
CREATE POLICY "Parents view child submissions"
ON public.assignment_submissions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.parent_student_links psl
        WHERE psl.parent_id = auth.uid()
        AND psl.student_id = public.assignment_submissions.student_id
        AND psl.status = 'active'
    )
);

-- resources
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Resources readable by authenticated users"
ON public.resources FOR SELECT TO authenticated USING (true);

-- user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own preferences"
ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own preferences"
ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own preferences"
ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);

-- email_log (own rows only; inserts via service role / backend)
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own email log"
ON public.email_log FOR SELECT USING (recipient_id = auth.uid());

-- audit_logs: locked down (service role bypasses RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- REGISTRATION RPCs (SECURITY DEFINER — role cannot be spoofed)
-- ============================================================

CREATE OR REPLACE FUNCTION public.register_student(
    p_full_name text,
    p_grade int,
    p_section text,
    p_stream text DEFAULT NULL,
    p_elective_subject_id uuid DEFAULT NULL,
    p_parent_name text DEFAULT NULL,
    p_parent_email text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
        RAISE EXCEPTION 'Profile already exists';
    END IF;
    IF p_grade IS NULL OR p_grade NOT BETWEEN 6 AND 12 THEN
        RAISE EXCEPTION 'Invalid grade';
    END IF;
    IF p_section IS NULL OR length(trim(p_section)) = 0 THEN
        RAISE EXCEPTION 'Section required';
    END IF;
    IF p_grade IN (11, 12) AND (p_stream IS NULL OR p_stream NOT IN ('science', 'commerce', 'arts')) THEN
        RAISE EXCEPTION 'Stream required for grades 11-12';
    END IF;
    IF p_grade IN (11, 12) AND p_elective_subject_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.subjects s
            WHERE s.id = p_elective_subject_id AND s.grade = p_grade AND s.is_elective = true
        ) THEN
            RAISE EXCEPTION 'Invalid elective for grade';
        END IF;
    END IF;

    INSERT INTO public.profiles (
        id, full_name, role, grade, section, stream, elective_subject_id,
        parent_name, parent_email
    ) VALUES (
        auth.uid(), p_full_name, 'student', p_grade, p_section,
        CASE WHEN p_grade IN (11, 12) THEN p_stream ELSE NULL END,
        CASE WHEN p_grade IN (11, 12) THEN p_elective_subject_id ELSE NULL END,
        p_parent_name, p_parent_email
    );

    PERFORM public.initialize_performance_tracker(
        auth.uid(),
        p_grade,
        CASE WHEN p_grade IN (11, 12) THEN p_stream ELSE NULL END,
        CASE WHEN p_grade IN (11, 12) THEN p_elective_subject_id ELSE NULL END
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.register_parent(p_full_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
        RAISE EXCEPTION 'Profile already exists';
    END IF;
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (auth.uid(), p_full_name, 'parent');
END;
$$;

CREATE OR REPLACE FUNCTION public.register_teacher(
    p_full_name text,
    p_school_name text,
    p_subjects_taught uuid[],
    p_assignments jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    elem jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
        RAISE EXCEPTION 'Profile already exists';
    END IF;
    IF p_subjects_taught IS NULL THEN
        RAISE EXCEPTION 'subjects_taught required';
    END IF;

    INSERT INTO public.profiles (id, full_name, role, school_name, subjects_taught, is_verified)
    VALUES (auth.uid(), p_full_name, 'teacher', p_school_name, p_subjects_taught, false);

    IF p_assignments IS NOT NULL AND jsonb_typeof(p_assignments) = 'array' THEN
        FOR elem IN SELECT * FROM jsonb_array_elements(p_assignments)
        LOOP
            INSERT INTO public.teacher_assignments (teacher_id, grade, section, subject_id)
            VALUES (
                auth.uid(),
                (elem->>'grade')::int,
                trim(elem->>'section'),
                (elem->>'subject_id')::uuid
            );
        END LOOP;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_parent_to_student(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_jwt_email text := lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')));
    v_student_email text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'parent') THEN
        RAISE EXCEPTION 'Caller must be a parent';
    END IF;
    SELECT lower(trim(parent_email)) INTO v_student_email
    FROM public.profiles
    WHERE id = p_student_id AND role = 'student';
    IF v_student_email IS NULL THEN
        RAISE EXCEPTION 'Student not found';
    END IF;
    IF v_student_email IS DISTINCT FROM v_jwt_email THEN
        RAISE EXCEPTION 'Parent email does not match student record';
    END IF;

    INSERT INTO public.parent_student_links (parent_id, student_id, status, linked_at)
    VALUES (auth.uid(), p_student_id, 'active', now())
    ON CONFLICT (parent_id, student_id) DO UPDATE
    SET status = 'active', linked_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_student(text, int, text, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_parent(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_teacher(text, text, uuid[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_parent_to_student(uuid) TO authenticated;

-- Helper functions for reads
GRANT EXECUTE ON FUNCTION public.get_student_subjects(int, varchar, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_available_electives(int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_all_subjects_for_grade(int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_topics_for_subject(uuid, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_units_for_subject(uuid, int) TO authenticated, anon;

-- ============================================================
-- MINIMAL SEED (grade 9 + one topic row for tracker smoke test)
-- ============================================================

INSERT INTO public.subjects (name, grade, subject_group, stream, is_elective, sort_order)
VALUES
    ('Mathematics', 9, NULL, NULL, false, 1),
    ('Science', 9, NULL, NULL, false, 2),
    ('English', 9, NULL, NULL, false, 3);

INSERT INTO public.topics (subject_id, grade, unit_name, unit_number, chapter_name, chapter_number, topic_name, topic_number)
SELECT s.id, 9, 'Number Systems', 1, 'Real Numbers', 1, 'Irrational Numbers', 1
FROM public.subjects s WHERE s.name = 'Mathematics' AND s.grade = 9 LIMIT 1;

INSERT INTO public.topics (subject_id, grade, unit_name, unit_number, chapter_name, chapter_number, topic_name, topic_number)
SELECT s.id, 9, 'Number Systems', 1, 'Real Numbers', 1, 'Rationalizing Denominators', 2
FROM public.subjects s WHERE s.name = 'Mathematics' AND s.grade = 9 LIMIT 1;

INSERT INTO public.topics (subject_id, grade, unit_name, unit_number, chapter_name, chapter_number, topic_name, topic_number)
SELECT s.id, 9, 'Natural Science', 1, 'Matter', 1, 'Introduction', 1
FROM public.subjects s WHERE s.name = 'Science' AND s.grade = 9 LIMIT 1;

INSERT INTO public.topics (subject_id, grade, unit_name, unit_number, chapter_name, chapter_number, topic_name, topic_number)
SELECT s.id, 9, 'Literature', 1, 'Prose', 1, 'Reading comprehension', 1
FROM public.subjects s WHERE s.name = 'English' AND s.grade = 9 LIMIT 1;
