-- Lengthen student_link_code from 6 chars (XX1234, ~6.76M combos) to 8 chars
-- (XXX12345, ~1.76B combos). The 6-char format remains valid so existing
-- students don't lose their code, and parents who memorized the legacy code
-- can still link. New students (or any student who explicitly rotates) get
-- 8-char codes.
--
-- Combined with per-parent and per-student-reference rate limiting in
-- app/parent/link-child/actions.ts, brute-forcing the link code becomes
-- infeasible: 10 attempts/hour/parent × 1.76B codes = ~20M years.

ALTER TABLE public.profiles
    ALTER COLUMN student_link_code TYPE varchar(8);

-- Replace the old format check with a permissive one that accepts both shapes.
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_student_link_code_format_ck;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_student_link_code_format_ck
    CHECK (
        student_link_code IS NULL
        OR student_link_code ~ '^[A-Z]{2}[0-9]{4}$'
        OR student_link_code ~ '^[A-Z]{3}[0-9]{5}$'
    );

-- All NEW generations produce 8-char codes. Existing students keep theirs
-- (the column type expanded and the constraint still permits them).
CREATE OR REPLACE FUNCTION public._generate_student_link_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
    b bytea;
    d int;
BEGIN
    -- 7 random bytes: 3 letters + 5-digit number (00000-99999).
    b := extensions.gen_random_bytes(7);
    d := (
        (get_byte(b, 3)::bigint << 24)
        | (get_byte(b, 4)::bigint << 16)
        | (get_byte(b, 5)::bigint << 8)
        | get_byte(b, 6)::bigint
    ) % 100000;
    RETURN chr(65 + (get_byte(b, 0) % 26))
        || chr(65 + (get_byte(b, 1) % 26))
        || chr(65 + (get_byte(b, 2) % 26))
        || lpad(d::text, 5, '0');
END;
$$;

REVOKE ALL ON FUNCTION public._generate_student_link_code() FROM PUBLIC;
