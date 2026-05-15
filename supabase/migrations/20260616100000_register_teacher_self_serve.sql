-- Self-service teacher signup: profile row only (no student linking yet; school ID comes later).
CREATE OR REPLACE FUNCTION public.register_teacher(p_full_name text, p_school_name text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_school text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Profile already exists';
  END IF;
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'Full name required';
  END IF;

  v_school := NULLIF(trim(COALESCE(p_school_name, '')), '');

  INSERT INTO public.profiles (id, full_name, role, school_name, is_verified)
  VALUES (auth.uid(), trim(p_full_name), 'teacher', v_school, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.register_teacher(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_teacher(text, text) TO authenticated;
