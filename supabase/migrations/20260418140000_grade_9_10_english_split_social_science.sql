-- Grade 9: replace single "English" with three NCERT-aligned papers; add Social Science.
-- Grade 10: seed full core set (Math, Science, three English papers, Social Science) with minimal topics.
-- Backfill performance_tracker rows for students so new curriculum appears without manual sync.

-- ---------------------------------------------------------------------------
-- Grade 9 — split legacy English (if present)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_old_english uuid;
    v_beehive uuid;
BEGIN
    SELECT id INTO v_old_english
    FROM public.subjects
    WHERE name = 'English' AND grade = 9 AND is_active = TRUE
    LIMIT 1;

    IF v_old_english IS NULL THEN
        RAISE NOTICE 'grade_9_english_split: no legacy English row; skipping FK rewires.';
    ELSIF EXISTS (SELECT 1 FROM public.subjects WHERE grade = 9 AND name = 'English — Beehive' LIMIT 1) THEN
        RAISE NOTICE 'grade_9_english_split: English papers already present; skipping split.';
    ELSE
        INSERT INTO public.subjects (name, grade, subject_group, stream, is_elective, sort_order, is_active)
        VALUES
            ('English — Beehive', 9, 'English', NULL, FALSE, 3, TRUE),
            ('English — Moments', 9, 'English', NULL, FALSE, 4, TRUE),
            ('English — Words and Expressions', 9, 'English', NULL, FALSE, 5, TRUE);

        SELECT id INTO v_beehive FROM public.subjects WHERE name = 'English — Beehive' AND grade = 9 LIMIT 1;

        UPDATE public.topics SET subject_id = v_beehive WHERE subject_id = v_old_english;
        UPDATE public.performance_tracker SET subject_id = v_beehive WHERE subject_id = v_old_english;
        UPDATE public.tests SET subject_id = v_beehive WHERE subject_id = v_old_english;
        UPDATE public.teacher_assignments SET subject_id = v_beehive WHERE subject_id = v_old_english;
        UPDATE public.assignments SET subject_id = v_beehive WHERE subject_id = v_old_english;

        DELETE FROM public.subjects WHERE id = v_old_english;
    END IF;
END $$;

-- Grade 9 — Social Science (single consolidated subject; distinct id from English/Math/Science)
INSERT INTO public.subjects (name, grade, subject_group, stream, is_elective, sort_order, is_active)
SELECT 'Social Science', 9, 'Social Science', NULL, FALSE, 6, TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM public.subjects WHERE grade = 9 AND name = 'Social Science'
);

-- Grade 9 — minimal topic for Social Science (for tracker / practice wiring)
INSERT INTO public.topics (subject_id, grade, unit_name, unit_number, chapter_name, chapter_number, topic_name, topic_number)
SELECT s.id, 9, 'Introduction', 1, 'Overview', 1, 'What is Social Science?', 1
FROM public.subjects s
WHERE s.name = 'Social Science' AND s.grade = 9
  AND NOT EXISTS (
 SELECT 1 FROM public.topics t WHERE t.subject_id = s.id AND t.grade = 9 AND t.topic_name = 'What is Social Science?'
  );

-- Grade 9 — placeholder topics for the two new English books (Beehive already has migrated rows from legacy English)
INSERT INTO public.topics (subject_id, grade, unit_name, unit_number, chapter_name, chapter_number, topic_name, topic_number)
SELECT s.id, 9, 'Literature', 1, 'Prose', 1, 'Reading skills — introduction', 1
FROM public.subjects s
WHERE s.name = 'English — Moments' AND s.grade = 9
  AND NOT EXISTS (SELECT 1 FROM public.topics t WHERE t.subject_id = s.id AND t.grade = 9);

INSERT INTO public.topics (subject_id, grade, unit_name, unit_number, chapter_name, chapter_number, topic_name, topic_number)
SELECT s.id, 9, 'Workbook', 1, 'Grammar & composition', 1, 'Practice overview', 1
FROM public.subjects s
WHERE s.name = 'English — Words and Expressions' AND s.grade = 9
  AND NOT EXISTS (SELECT 1 FROM public.topics t WHERE t.subject_id = s.id AND t.grade = 9);

-- ---------------------------------------------------------------------------
-- Grade 10 — core subjects (only if not already seeded)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.subjects WHERE grade = 10 AND name = 'Mathematics' LIMIT 1) THEN
        RAISE NOTICE 'grade_10_core: already present; skipping.';
        RETURN;
    END IF;

    INSERT INTO public.subjects (name, grade, subject_group, stream, is_elective, sort_order, is_active)
    VALUES
        ('Mathematics', 10, NULL, NULL, FALSE, 1, TRUE),
        ('Science', 10, NULL, NULL, FALSE, 2, TRUE),
        ('English — First Flight', 10, 'English', NULL, FALSE, 3, TRUE),
        ('English — Footprints without Feet', 10, 'English', NULL, FALSE, 4, TRUE),
        ('English — Words and Expressions', 10, 'English', NULL, FALSE, 5, TRUE),
        ('Social Science', 10, 'Social Science', NULL, FALSE, 6, TRUE);

    INSERT INTO public.topics (subject_id, grade, unit_name, unit_number, chapter_name, chapter_number, topic_name, topic_number)
    SELECT s.id, 10, 'Number Systems', 1, 'Real Numbers', 1, 'Introduction', 1
    FROM public.subjects s WHERE s.name = 'Mathematics' AND s.grade = 10 LIMIT 1;

    INSERT INTO public.topics (subject_id, grade, unit_name, unit_number, chapter_name, chapter_number, topic_name, topic_number)
    SELECT s.id, 10, 'Natural Science', 1, 'Matter', 1, 'Introduction', 1
    FROM public.subjects s WHERE s.name = 'Science' AND s.grade = 10 LIMIT 1;

    INSERT INTO public.topics (subject_id, grade, unit_name, unit_number, chapter_name, chapter_number, topic_name, topic_number)
    SELECT s.id, 10, 'Literature', 1, 'Prose', 1, 'Reading comprehension', 1
    FROM public.subjects s WHERE s.name = 'English — First Flight' AND s.grade = 10 LIMIT 1;

    INSERT INTO public.topics (subject_id, grade, unit_name, unit_number, chapter_name, chapter_number, topic_name, topic_number)
    SELECT s.id, 10, 'Literature', 1, 'Supplementary', 1, 'Reading skills', 1
    FROM public.subjects s WHERE s.name = 'English — Footprints without Feet' AND s.grade = 10 LIMIT 1;

    INSERT INTO public.topics (subject_id, grade, unit_name, unit_number, chapter_name, chapter_number, topic_name, topic_number)
    SELECT s.id, 10, 'Workbook', 1, 'Grammar & composition', 1, 'Practice overview', 1
    FROM public.subjects s WHERE s.name = 'English — Words and Expressions' AND s.grade = 10 LIMIT 1;

    INSERT INTO public.topics (subject_id, grade, unit_name, unit_number, chapter_name, chapter_number, topic_name, topic_number)
    SELECT s.id, 10, 'Introduction', 1, 'Overview', 1, 'What is Social Science?', 1
    FROM public.subjects s WHERE s.name = 'Social Science' AND s.grade = 10 LIMIT 1;
END $$;

-- ---------------------------------------------------------------------------
-- Backfill tracker rows for all students (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO public.performance_tracker (student_id, topic_id, subject_id, status)
SELECT p.id, t.id, t.subject_id, 'not_tested'
FROM public.profiles p
INNER JOIN public.topics t ON t.grade = p.grade AND t.is_active = TRUE
INNER JOIN public.get_student_subjects(
    p.grade,
    CASE WHEN p.grade IN (11, 12) THEN p.stream ELSE NULL END,
    CASE WHEN p.grade IN (11, 12) THEN p.elective_subject_id ELSE NULL END
) s ON t.subject_id = s.id
WHERE p.role = 'student'
  AND p.grade IS NOT NULL
ON CONFLICT (student_id, topic_id) DO NOTHING;
