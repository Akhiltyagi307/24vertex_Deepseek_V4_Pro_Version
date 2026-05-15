-- Teacher self-serve signup (register_teacher) inserts profiles.role = 'teacher'.
-- Migration 20260428203000 removed the teacher portal but also narrowed profiles_role_check
-- to ('student', 'parent', 'admin'), which broke register_teacher at INSERT time.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'parent', 'teacher', 'admin'));
