-- Split Class XII commerce_with_maths Mathematics into two NCERT-style parts.
-- UPDATE preserves the existing row UUID (FK safety on teacher_assignments, tests, performance_tracker).

UPDATE public.subjects
SET
  name = 'Mathematics Part 1',
  subject_group = 'Mathematics',
  sort_order = 9,
  metadata = $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT Mathematics (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","grade":12,"cbse_combination":"commerce_with_mathematics","volume":1,"primary_textbook":{"series_title":"Mathematics","part":"Part 1","description":"NCERT Class XII Mathematics - first volume."},"language_medium":"English","notes":"Verify part split (e.g. Ganita Prakash vs legacy) on ncert.nic.in."}$$::jsonb
WHERE grade = 12
  AND stream = 'commerce_with_maths'
  AND name = 'Mathematics';

INSERT INTO public.subjects (name, grade, subject_group, stream, is_elective, sort_order, is_active, metadata)
SELECT
  'Mathematics Part 2',
  12,
  'Mathematics',
  'commerce_with_maths',
  false,
  10,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT Mathematics (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","grade":12,"cbse_combination":"commerce_with_mathematics","volume":2,"primary_textbook":{"series_title":"Mathematics","part":"Part 2","description":"NCERT Class XII Mathematics - second volume."},"language_medium":"English","notes":"Confirm chapter list on official NCERT Class XII PDFs."}$$::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subjects s
  WHERE s.grade = 12
    AND s.stream = 'commerce_with_maths'
    AND s.name = 'Mathematics Part 2'
);
