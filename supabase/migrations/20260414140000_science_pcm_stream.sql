-- Grade 11 Science stream: PCM (Physics, Chemistry, Mathematics; no Biology).

ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_stream_check;
ALTER TABLE public.subjects ADD CONSTRAINT subjects_stream_check CHECK (
    stream IN (
        'science',
        'science_pcmb',
        'science_pcm',
        'commerce',
        'commerce_with_maths',
        'arts'
    ) OR stream IS NULL
);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_stream_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_stream_check CHECK (
    stream IN (
        'science',
        'science_pcmb',
        'science_pcm',
        'commerce',
        'commerce_with_maths',
        'arts'
    ) OR stream IS NULL
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
        OR p_stream NOT IN (
            'science',
            'science_pcmb',
            'science_pcm',
            'commerce',
            'commerce_with_maths',
            'arts'
        )
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

DELETE FROM public.subjects WHERE grade = 11 AND stream = 'science_pcm';

INSERT INTO public.subjects (name, grade, subject_group, stream, is_elective, sort_order, is_active, metadata)
VALUES
(
  'English Core',
  11,
  'English',
  'science_pcm',
  false,
  1,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT English Core (Class XI)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcm","role":"core_main","primary_textbook":{"series_title":"Hornbill","description":"NCERT Class XI English Core main textbook."},"language_medium":"English"}$$::jsonb
),
(
  'English Supplementary',
  11,
  'English',
  'science_pcm',
  false,
  2,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT English Core (Class XI)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcm","role":"core_supplementary","primary_textbook":{"series_title":"Snapshots","description":"NCERT Class XI English Core supplementary reader."},"language_medium":"English"}$$::jsonb
),
(
  'Physics Part 1',
  11,
  'Physics',
  'science_pcm',
  false,
  3,
  true,
  $${"curriculum_framework":"CBSE Science (Class XI); NCERT Physics","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcm","volume":1,"primary_textbook":{"series_title":"Physics","part":"Part 1","description":"NCERT Class XI Physics textbook - first volume."},"language_medium":"English","notes":"Confirm unit split on official NCERT PDFs."}$$::jsonb
),
(
  'Physics Part 2',
  11,
  'Physics',
  'science_pcm',
  false,
  4,
  true,
  $${"curriculum_framework":"CBSE Science (Class XI); NCERT Physics","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcm","volume":2,"primary_textbook":{"series_title":"Physics","part":"Part 2","description":"NCERT Class XI Physics textbook - second volume."},"language_medium":"English"}$$::jsonb
),
(
  'Chemistry Part 1',
  11,
  'Chemistry',
  'science_pcm',
  false,
  5,
  true,
  $${"curriculum_framework":"CBSE Science (Class XI); NCERT Chemistry","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcm","volume":1,"primary_textbook":{"series_title":"Chemistry","part":"Part 1","description":"NCERT Class XI Chemistry - first volume."},"language_medium":"English"}$$::jsonb
),
(
  'Chemistry Part 2',
  11,
  'Chemistry',
  'science_pcm',
  false,
  6,
  true,
  $${"curriculum_framework":"CBSE Science (Class XI); NCERT Chemistry","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcm","volume":2,"primary_textbook":{"series_title":"Chemistry","part":"Part 2","description":"NCERT Class XI Chemistry - second volume."},"language_medium":"English"}$$::jsonb
),
(
  'Mathematics',
  11,
  NULL,
  'science_pcm',
  false,
  7,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT Mathematics (Class XI)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcm","primary_textbook":{"series_title":"Mathematics","subtitle":"Textbook for Class XI","description":"NCERT Class XI Mathematics."},"language_medium":"English"}$$::jsonb
);
