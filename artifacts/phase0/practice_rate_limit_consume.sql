-- Captured 2026-05-03 via Supabase MCP.
-- Project: suwakggcbxmmvqzeudmq (EDU_AI), Postgres 17.6.1.105
-- Source of truth for behavior I must preserve in the new public.rl_consume(...).
-- Note: this RPC depends on auth.uid() so it only works for authenticated Supabase
-- sessions. The new rl_consume is auth-agnostic (caller provides the key) so it can
-- also serve admin login (IP-keyed) and any other future use case.

CREATE OR REPLACE FUNCTION public.practice_rate_limit_consume(
  p_bucket text,
  p_limit_n integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, remaining integer, reset_at timestamp without time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_student UUID := auth.uid();
  v_window TIMESTAMP;
  v_count INT;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_window := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  ) AT TIME ZONE 'UTC';

  INSERT INTO public.practice_rate_limits (student_id, bucket, window_start, count)
  VALUES (v_student, p_bucket, v_window, 1)
  ON CONFLICT (student_id, bucket, window_start)
  DO UPDATE SET count = public.practice_rate_limits.count + 1
    WHERE public.practice_rate_limits.count < p_limit_n
  RETURNING count INTO v_count;

  IF v_count IS NULL THEN
    SELECT count INTO v_count FROM public.practice_rate_limits
    WHERE student_id = v_student AND bucket = p_bucket AND window_start = v_window;
    allowed := FALSE;
    remaining := 0;
    reset_at := v_window + make_interval(secs => p_window_seconds);
    RETURN NEXT;
    RETURN;
  END IF;

  allowed := TRUE;
  remaining := GREATEST(0, p_limit_n - v_count);
  reset_at := v_window + make_interval(secs => p_window_seconds);
  RETURN NEXT;
END;
$function$;
