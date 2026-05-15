-- Teacher self-signup: require manual admin approval (is_verified false) and store phone.
DROP FUNCTION IF EXISTS public.register_teacher(text, text);

CREATE OR REPLACE FUNCTION public.register_teacher(
  p_full_name text,
  p_school_name text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_school text;
  v_phone text;
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

  v_phone := NULLIF(trim(COALESCE(p_phone, '')), '');
  IF v_phone IS NULL OR length(v_phone) < 8 THEN
    RAISE EXCEPTION 'Phone required';
  END IF;
  IF length(v_phone) > 32 THEN
    RAISE EXCEPTION 'Phone too long';
  END IF;

  v_school := NULLIF(trim(COALESCE(p_school_name, '')), '');

  INSERT INTO public.profiles (id, full_name, role, school_name, phone, is_verified)
  VALUES (auth.uid(), trim(p_full_name), 'teacher', v_school, v_phone, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.register_teacher(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_teacher(text, text, text) TO authenticated;
