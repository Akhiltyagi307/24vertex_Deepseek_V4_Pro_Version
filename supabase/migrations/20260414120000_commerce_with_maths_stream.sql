-- Senior stream: Commerce with Mathematics (distinct from plain Commerce).
-- get_student_subjects matches stream exactly; plain commerce keeps 7 papers, this stream has 8.

ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_stream_check;
ALTER TABLE public.subjects ADD CONSTRAINT subjects_stream_check CHECK (
    stream IN ('science', 'commerce', 'arts', 'commerce_with_maths') OR stream IS NULL
);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_stream_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_stream_check CHECK (
    stream IN ('science', 'commerce', 'arts', 'commerce_with_maths') OR stream IS NULL
);

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
DECLARE
    v_email_confirmed boolean;
    v_code text;
    n int := 0;
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
    IF p_grade IN (11, 12) AND (
        p_stream IS NULL
        OR p_stream NOT IN ('science', 'commerce', 'arts', 'commerce_with_maths')
    ) THEN
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

    SELECT (u.email_confirmed_at IS NOT NULL) INTO v_email_confirmed
    FROM auth.users u
    WHERE u.id = auth.uid();

    LOOP
        v_code := public._generate_student_link_code();
        BEGIN
            INSERT INTO public.profiles (
                id, full_name, role, grade, section, stream, elective_subject_id,
                parent_name, parent_email, is_verified, student_link_code
            ) VALUES (
                auth.uid(), p_full_name, 'student', p_grade, p_section,
                CASE WHEN p_grade IN (11, 12) THEN p_stream ELSE NULL END,
                CASE WHEN p_grade IN (11, 12) THEN p_elective_subject_id ELSE NULL END,
                p_parent_name, p_parent_email,
                COALESCE(v_email_confirmed, false),
                v_code
            );
            EXIT;
        EXCEPTION
            WHEN unique_violation THEN
                n := n + 1;
                IF n > 100 THEN
                    RAISE EXCEPTION 'Could not allocate student link code';
                END IF;
        END;
    END LOOP;

    PERFORM public.initialize_performance_tracker(
        auth.uid(),
        p_grade,
        CASE WHEN p_grade IN (11, 12) THEN p_stream ELSE NULL END,
        CASE WHEN p_grade IN (11, 12) THEN p_elective_subject_id ELSE NULL END
    );
END;
$$;

-- Optional Class XI Mathematics under plain Commerce (superseded by commerce_with_maths stream).
DELETE FROM public.subjects
WHERE grade = 11
  AND stream = 'commerce'
  AND name = 'Mathematics'
  AND is_elective = true;

DELETE FROM public.subjects WHERE grade = 11 AND stream = 'commerce_with_maths';

INSERT INTO public.subjects (name, grade, subject_group, stream, is_elective, sort_order, is_active, metadata)
VALUES
(
  'English Core',
  11,
  'English',
  'commerce_with_maths',
  false,
  1,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT English Core (Class XI)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","role":"core_main","primary_textbook":{"series_title":"Hornbill","description":"NCERT Class XI English Core main textbook: prose and poetry units."},"language_medium":"English","notes":"Woven Words is typically English Elective; Commerce Core uses Hornbill with Snapshots."}$$::jsonb
),
(
  'English Supplementary',
  11,
  'English',
  'commerce_with_maths',
  false,
  2,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT English Core (Class XI)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","role":"core_supplementary","primary_textbook":{"series_title":"Snapshots","description":"NCERT Class XI English Core supplementary reader."},"language_medium":"English"}$$::jsonb
),
(
  'Business Studies',
  11,
  NULL,
  'commerce_with_maths',
  false,
  3,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Business Studies (Class XI)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","primary_textbook":{"series_title":"Business Studies","subtitle":"Textbook for Class XI","description":"NCERT Class XI Business Studies."},"language_medium":"English"}$$::jsonb
),
(
  'Economics',
  11,
  NULL,
  'commerce_with_maths',
  false,
  4,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Economics (Class XI)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","strand":"indian_economic_development","primary_textbook":{"series_title":"Indian Economic Development","description":"NCERT Class XI economics textbook."},"language_medium":"English"}$$::jsonb
),
(
  'Statistics',
  11,
  NULL,
  'commerce_with_maths',
  false,
  5,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Statistics for Economics (Class XI)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","strand":"statistics_for_economics","primary_textbook":{"series_title":"Statistics for Economics","description":"NCERT Class XI statistics for economics."},"language_medium":"English"}$$::jsonb
),
(
  'Financial Accounting Part 1',
  11,
  'Financial Accounting',
  'commerce_with_maths',
  false,
  6,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Accountancy (Class XI)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","volume":1,"primary_textbook":{"series_title":"Financial Accounting","part":"Part 1","description":"NCERT Class XI Financial Accounting Part 1."},"language_medium":"English"}$$::jsonb
),
(
  'Financial Accounting Part 2',
  11,
  'Financial Accounting',
  'commerce_with_maths',
  false,
  7,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Accountancy (Class XI)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","volume":2,"primary_textbook":{"series_title":"Financial Accounting","part":"Part 2","description":"NCERT Class XI Financial Accounting Part 2."},"language_medium":"English"}$$::jsonb
),
(
  'Mathematics',
  11,
  NULL,
  'commerce_with_maths',
  false,
  8,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT Mathematics (Class XI)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","cbse_combination":"commerce_with_mathematics","primary_textbook":{"series_title":"Mathematics","subtitle":"Textbook for Class XI","description":"NCERT Class XI Mathematics (core paper, same syllabus family as Science stream Mathematics)."},"language_medium":"English","notes":"Core for commerce_with_maths stream; confirm rationalised TOC on ncert.nic.in."}$$::jsonb
);
