-- Class XII Commerce (without Mathematics; NCERT-oriented).

DELETE FROM public.subjects WHERE grade = 12 AND stream = 'commerce';

INSERT INTO public.subjects (name, grade, subject_group, stream, is_elective, sort_order, is_active, metadata)
VALUES
(
  'English Core',
  12,
  'English',
  'commerce',
  false,
  1,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT English Core (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce","grade":12,"role":"core_main","primary_textbook":{"series_title":"Flamingo","description":"NCERT Class XII English Core main textbook (prose and poetry)."},"language_medium":"English","notes":"Confirm current main reader title on ncert.nic.in for the session."}$$::jsonb
),
(
  'English Supplementary',
  12,
  'English',
  'commerce',
  false,
  2,
  true,
  $${"curriculum_framework":"CBSE Senior Secondary Stage; NCERT English Core (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce","grade":12,"role":"core_supplementary","primary_textbook":{"series_title":"Vistas","description":"NCERT Class XII English Core supplementary reader."},"language_medium":"English"}$$::jsonb
),
(
  'Business Studies Part 1',
  12,
  'Business Studies',
  'commerce',
  false,
  3,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Business Studies (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce","grade":12,"volume":1,"primary_textbook":{"series_title":"Business Studies","part":"Part 1","description":"NCERT Class XII Business Studies - first volume."},"language_medium":"English","notes":"Confirm rationalised part split on official NCERT PDFs."}$$::jsonb
),
(
  'Business Studies Part 2',
  12,
  'Business Studies',
  'commerce',
  false,
  4,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Business Studies (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce","grade":12,"volume":2,"primary_textbook":{"series_title":"Business Studies","part":"Part 2","description":"NCERT Class XII Business Studies - second volume."},"language_medium":"English"}$$::jsonb
),
(
  'Macroeconomics',
  12,
  'Economics',
  'commerce',
  false,
  5,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Economics (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce","grade":12,"strand":"macroeconomics","primary_textbook":{"series_title":"Macroeconomics","subtitle":"Textbook for Class XII","description":"NCERT Class XII Macroeconomics."},"language_medium":"English"}$$::jsonb
),
(
  'Microeconomics',
  12,
  'Economics',
  'commerce',
  false,
  6,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Economics (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce","grade":12,"strand":"microeconomics","primary_textbook":{"series_title":"Introductory Microeconomics","subtitle":"Textbook for Class XII","description":"NCERT Class XII Introductory Microeconomics."},"language_medium":"English"}$$::jsonb
),
(
  'Financial Accounting Part 1',
  12,
  'Financial Accounting',
  'commerce',
  false,
  7,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Accountancy (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce","grade":12,"volume":1,"primary_textbook":{"series_title":"Financial Accounting","part":"Part 1","description":"NCERT Class XII Financial Accounting Part 1."},"language_medium":"English"}$$::jsonb
),
(
  'Financial Accounting Part 2',
  12,
  'Financial Accounting',
  'commerce',
  false,
  8,
  true,
  $${"curriculum_framework":"CBSE Commerce stream; NCERT Accountancy (Class XII)","publisher":"National Council of Educational Research and Training","publisher_abbrev":"NCERT","official_textbook_portal":"https://ncert.nic.in/textbook.php","stream":"commerce","grade":12,"volume":2,"primary_textbook":{"series_title":"Financial Accounting","part":"Part 2","description":"NCERT Class XII Financial Accounting Part 2."},"language_medium":"English"}$$::jsonb
);
