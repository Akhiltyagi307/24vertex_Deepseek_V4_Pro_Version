-- Seed common Grade 11/12 elective subjects for student signup.
-- Idempotent: only inserts missing rows and re-activates known electives.

WITH seed(name, grade, subject_group, stream, is_elective, sort_order, is_active, metadata) AS (
	VALUES
		(
			'Computer Science',
			11,
			'Elective',
			NULL,
			TRUE,
			90,
			TRUE,
			'{"category":"senior_elective","scope":"cross_stream","source":"pdr_v3"}'::jsonb
		),
		(
			'Physical Education',
			11,
			'Elective',
			NULL,
			TRUE,
			91,
			TRUE,
			'{"category":"senior_elective","scope":"cross_stream","source":"pdr_v3"}'::jsonb
		),
		(
			'Psychology',
			11,
			'Elective',
			NULL,
			TRUE,
			92,
			TRUE,
			'{"category":"senior_elective","scope":"cross_stream","source":"pdr_v3"}'::jsonb
		),
		(
			'Fine Arts',
			11,
			'Elective',
			NULL,
			TRUE,
			93,
			TRUE,
			'{"category":"senior_elective","scope":"cross_stream","source":"pdr_v3"}'::jsonb
		),
		(
			'Home Science',
			11,
			'Elective',
			NULL,
			TRUE,
			94,
			TRUE,
			'{"category":"senior_elective","scope":"cross_stream","source":"pdr_v3"}'::jsonb
		),
		(
			'Computer Science',
			12,
			'Elective',
			NULL,
			TRUE,
			90,
			TRUE,
			'{"category":"senior_elective","scope":"cross_stream","source":"pdr_v3"}'::jsonb
		),
		(
			'Physical Education',
			12,
			'Elective',
			NULL,
			TRUE,
			91,
			TRUE,
			'{"category":"senior_elective","scope":"cross_stream","source":"pdr_v3"}'::jsonb
		),
		(
			'Psychology',
			12,
			'Elective',
			NULL,
			TRUE,
			92,
			TRUE,
			'{"category":"senior_elective","scope":"cross_stream","source":"pdr_v3"}'::jsonb
		),
		(
			'Fine Arts',
			12,
			'Elective',
			NULL,
			TRUE,
			93,
			TRUE,
			'{"category":"senior_elective","scope":"cross_stream","source":"pdr_v3"}'::jsonb
		),
		(
			'Home Science',
			12,
			'Elective',
			NULL,
			TRUE,
			94,
			TRUE,
			'{"category":"senior_elective","scope":"cross_stream","source":"pdr_v3"}'::jsonb
		)
)
INSERT INTO public.subjects (name, grade, subject_group, stream, is_elective, sort_order, is_active, metadata)
SELECT s.name, s.grade, s.subject_group, s.stream, s.is_elective, s.sort_order, s.is_active, s.metadata
FROM seed s
WHERE NOT EXISTS (
	SELECT 1
	FROM public.subjects existing
	WHERE existing.grade = s.grade
		AND existing.name = s.name
		AND COALESCE(existing.stream, '') = COALESCE(s.stream, '')
);

UPDATE public.subjects
SET is_elective = TRUE,
	is_active = TRUE,
	subject_group = COALESCE(subject_group, 'Elective')
WHERE grade IN (11, 12)
	AND stream IS NULL
	AND name IN ('Computer Science', 'Physical Education', 'Psychology', 'Fine Arts', 'Home Science');
