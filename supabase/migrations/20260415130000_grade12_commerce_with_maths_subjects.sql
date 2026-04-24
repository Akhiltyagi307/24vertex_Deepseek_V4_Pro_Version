-- Class XII Commerce with Mathematics (NCERT-oriented).

DELETE FROM public.subjects WHERE grade = 12 AND stream = 'commerce_with_maths';

INSERT INTO public.subjects (name, grade, subject_group, stream, is_elective, sort_order, is_active, metadata)
VALUES
(
  'English Core',
  12,
  'English',
  'commerce_with_maths',
  false,
  1,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT English Core (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","grade":12,"role":"core_main","primary_textbook":{"series_title":"Flamingo","description":"NCERT Class XII English Core main textbook (prose and poetry)."},"language_medium":"English","notes":"Confirm current main reader title on ncert.nic.in for the session."}$$::jsonb
),
(
  'English Supplementary',
  12,
  'English',
  'commerce_with_maths',
  false,
  2,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT English Core (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","grade":12,"role":"core_supplementary","primary_textbook":{"series_title":"Vistas","description":"NCERT Class XII English Core supplementary reader."},"language_medium":"English"}$$::jsonb
),
(
  'Business Studies Part 1',
  12,
  'Business Studies',
  'commerce_with_maths',
  false,
  3,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Business Studies (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","grade":12,"volume":1,"primary_textbook":{"series_title":"Business Studies","part":"Part 1","description":"NCERT Class XII Business Studies - first volume."},"language_medium":"English","notes":"Confirm rationalised part split on official NCERT PDFs."}$$::jsonb
),
(
  'Business Studies Part 2',
  12,
  'Business Studies',
  'commerce_with_maths',
  false,
  4,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Business Studies (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","grade":12,"volume":2,"primary_textbook":{"series_title":"Business Studies","part":"Part 2","description":"NCERT Class XII Business Studies - second volume."},"language_medium":"English"}$$::jsonb
),
(
  'Macroeconomics',
  12,
  'Economics',
  'commerce_with_maths',
  false,
  5,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Economics (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","grade":12,"strand":"macroeconomics","primary_textbook":{"series_title":"Macroeconomics","subtitle":"Textbook for Class XII","description":"NCERT Class XII Macroeconomics."},"language_medium":"English"}$$::jsonb
),
(
  'Microeconomics',
  12,
  'Economics',
  'commerce_with_maths',
  false,
  6,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Economics (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","grade":12,"strand":"microeconomics","primary_textbook":{"series_title":"Introductory Microeconomics","subtitle":"Textbook for Class XII","description":"NCERT Class XII Introductory Microeconomics."},"language_medium":"English"}$$::jsonb
),
(
  'Financial Accounting Part 1',
  12,
  'Financial Accounting',
  'commerce_with_maths',
  false,
  7,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Accountancy (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","grade":12,"volume":1,"primary_textbook":{"series_title":"Financial Accounting","part":"Part 1","description":"NCERT Class XII Financial Accounting Part 1."},"language_medium":"English"}$$::jsonb
),
(
  'Financial Accounting Part 2',
  12,
  'Financial Accounting',
  'commerce_with_maths',
  false,
  8,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Accountancy (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","grade":12,"volume":2,"primary_textbook":{"series_title":"Financial Accounting","part":"Part 2","description":"NCERT Class XII Financial Accounting Part 2."},"language_medium":"English"}$$::jsonb
),
(
  'Mathematics Part 1',
  12,
  'Mathematics',
  'commerce_with_maths',
  false,
  9,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT Mathematics (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","grade":12,"cbse_combination":"commerce_with_mathematics","volume":1,"primary_textbook":{"series_title":"Mathematics","part":"Part 1","description":"NCERT Class XII Mathematics - first volume."},"language_medium":"English","notes":"Verify part split (e.g. Ganita Prakash vs legacy) on ncert.nic.in."}$$::jsonb
),
(
  'Mathematics Part 2',
  12,
  'Mathematics',
  'commerce_with_maths',
  false,
  10,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT Mathematics (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce_with_maths","grade":12,"cbse_combination":"commerce_with_mathematics","volume":2,"primary_textbook":{"series_title":"Mathematics","part":"Part 2","description":"NCERT Class XII Mathematics - second volume."},"language_medium":"English","notes":"Confirm chapter list on official NCERT Class XII PDFs."}$$::jsonb
);
