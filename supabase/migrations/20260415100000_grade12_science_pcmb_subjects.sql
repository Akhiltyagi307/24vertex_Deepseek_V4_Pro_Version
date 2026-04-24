-- Class XII Science PCMB subject catalogue (stream science_pcmb; distinct from grade 11 via grade column).

DELETE FROM public.subjects WHERE grade = 12 AND stream = 'science_pcmb';

INSERT INTO public.subjects (name, grade, subject_group, stream, is_elective, sort_order, is_active, metadata)
VALUES
(
  'English Core',
  12,
  'English',
  'science_pcmb',
  false,
  1,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT English Core (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcmb","grade":12,"role":"core_main","primary_textbook":{"series_title":"Flamingo","description":"NCERT Class XII English Core main textbook (prose and poetry)."},"language_medium":"English","notes":"Confirm current main reader title on ncert.nic.in for the session."}$$::jsonb
),
(
  'English Supplementary',
  12,
  'English',
  'science_pcmb',
  false,
  2,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT English Core (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcmb","grade":12,"role":"core_supplementary","primary_textbook":{"series_title":"Vistas","description":"NCERT Class XII English Core supplementary reader."},"language_medium":"English"}$$::jsonb
),
(
  'Physics Part 1',
  12,
  'Physics',
  'science_pcmb',
  false,
  3,
  true,
  $${"curriculum_framework":"CBSE Science (Class XII); NCERT Physics","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcmb","grade":12,"volume":1,"primary_textbook":{"series_title":"Physics","part":"Part 1","description":"NCERT Class XII Physics - first volume."},"language_medium":"English","notes":"Confirm rationalised unit split on official NCERT PDFs."}$$::jsonb
),
(
  'Physics Part 2',
  12,
  'Physics',
  'science_pcmb',
  false,
  4,
  true,
  $${"curriculum_framework":"CBSE Science (Class XII); NCERT Physics","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcmb","grade":12,"volume":2,"primary_textbook":{"series_title":"Physics","part":"Part 2","description":"NCERT Class XII Physics - second volume."},"language_medium":"English"}$$::jsonb
),
(
  'Biology',
  12,
  NULL,
  'science_pcmb',
  false,
  5,
  true,
  $${"curriculum_framework":"CBSE Science (Class XII); NCERT Biology","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcmb","grade":12,"primary_textbook":{"series_title":"Biology","subtitle":"Textbook for Class XII","description":"NCERT Class XII Biology."},"language_medium":"English"}$$::jsonb
),
(
  'Chemistry Part 1',
  12,
  'Chemistry',
  'science_pcmb',
  false,
  6,
  true,
  $${"curriculum_framework":"CBSE Science (Class XII); NCERT Chemistry","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcmb","grade":12,"volume":1,"primary_textbook":{"series_title":"Chemistry","part":"Part 1","description":"NCERT Class XII Chemistry - first volume."},"language_medium":"English"}$$::jsonb
),
(
  'Chemistry Part 2',
  12,
  'Chemistry',
  'science_pcmb',
  false,
  7,
  true,
  $${"curriculum_framework":"CBSE Science (Class XII); NCERT Chemistry","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcmb","grade":12,"volume":2,"primary_textbook":{"series_title":"Chemistry","part":"Part 2","description":"NCERT Class XII Chemistry - second volume."},"language_medium":"English"}$$::jsonb
),
(
  'Mathematics Part 1',
  12,
  'Mathematics',
  'science_pcmb',
  false,
  8,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT Mathematics (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcmb","grade":12,"volume":1,"primary_textbook":{"series_title":"Mathematics","part":"Part 1","description":"NCERT Class XII Mathematics - first volume (e.g. continuity, differentiation, integrals opening units per syllabus)."},"language_medium":"English","notes":"Titles may follow Ganita Prakash or legacy Mathematics parts; verify on ncert.nic.in."}$$::jsonb
),
(
  'Mathematics Part 2',
  12,
  'Mathematics',
  'science_pcmb',
  false,
  9,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT Mathematics (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"science_pcmb","grade":12,"volume":2,"primary_textbook":{"series_title":"Mathematics","part":"Part 2","description":"NCERT Class XII Mathematics - second volume (e.g. applications of integrals, differential equations, vectors, 3-D geometry, probability per syllabus)."},"language_medium":"English","notes":"Confirm part split and chapter list on official NCERT Class XII PDFs."}$$::jsonb
);
