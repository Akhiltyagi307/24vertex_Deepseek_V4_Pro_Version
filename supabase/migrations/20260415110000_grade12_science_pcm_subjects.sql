-- Class XII Science PCM (Physics, Chemistry, Mathematics; no Biology).

DELETE FROM public.subjects WHERE grade = 12 AND stream = 'science_pcm';

INSERT INTO public.subjects (name, grade, subject_group, stream, is_elective, sort_order, is_active, metadata)
VALUES
(
  'English Core',
  12,
  'English',
  'science_pcm',
  false,
  1,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT English Core (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcm","grade":12,"role":"core_main","primary_textbook":{"series_title":"Flamingo","description":"NCERT Class XII English Core main textbook (prose and poetry)."},"language_medium":"English","notes":"Confirm current main reader title on ncert.nic.in for the session."}$$::jsonb
),
(
  'English Supplementary',
  12,
  'English',
  'science_pcm',
  false,
  2,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT English Core (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcm","grade":12,"role":"core_supplementary","primary_textbook":{"series_title":"Vistas","description":"NCERT Class XII English Core supplementary reader."},"language_medium":"English"}$$::jsonb
),
(
  'Physics Part 1',
  12,
  'Physics',
  'science_pcm',
  false,
  3,
  true,
  $${"curriculum_framework":"CBSE Science (Class XII); NCERT Physics","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcm","grade":12,"volume":1,"primary_textbook":{"series_title":"Physics","part":"Part 1","description":"NCERT Class XII Physics - first volume."},"language_medium":"English","notes":"Confirm rationalised unit split on official NCERT PDFs."}$$::jsonb
),
(
  'Physics Part 2',
  12,
  'Physics',
  'science_pcm',
  false,
  4,
  true,
  $${"curriculum_framework":"CBSE Science (Class XII); NCERT Physics","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcm","grade":12,"volume":2,"primary_textbook":{"series_title":"Physics","part":"Part 2","description":"NCERT Class XII Physics - second volume."},"language_medium":"English"}$$::jsonb
),
(
  'Chemistry Part 1',
  12,
  'Chemistry',
  'science_pcm',
  false,
  5,
  true,
  $${"curriculum_framework":"CBSE Science (Class XII); NCERT Chemistry","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcm","grade":12,"volume":1,"primary_textbook":{"series_title":"Chemistry","part":"Part 1","description":"NCERT Class XII Chemistry - first volume."},"language_medium":"English"}$$::jsonb
),
(
  'Chemistry Part 2',
  12,
  'Chemistry',
  'science_pcm',
  false,
  6,
  true,
  $${"curriculum_framework":"CBSE Science (Class XII); NCERT Chemistry","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcm","grade":12,"volume":2,"primary_textbook":{"series_title":"Chemistry","part":"Part 2","description":"NCERT Class XII Chemistry - second volume."},"language_medium":"English"}$$::jsonb
),
(
  'Mathematics Part 1',
  12,
  'Mathematics',
  'science_pcm',
  false,
  7,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT Mathematics (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcm","grade":12,"volume":1,"primary_textbook":{"series_title":"Mathematics","part":"Part 1","description":"NCERT Class XII Mathematics - first volume."},"language_medium":"English","notes":"Verify part split (e.g. Ganita Prakash vs legacy) on ncert.nic.in."}$$::jsonb
),
(
  'Mathematics Part 2',
  12,
  'Mathematics',
  'science_pcm',
  false,
  8,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT Mathematics (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcm","grade":12,"volume":2,"primary_textbook":{"series_title":"Mathematics","part":"Part 2","description":"NCERT Class XII Mathematics - second volume."},"language_medium":"English","notes":"Confirm chapter list on official NCERT Class XII PDFs."}$$::jsonb
);
