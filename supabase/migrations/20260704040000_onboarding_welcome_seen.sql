-- Durable, cross-device record that a user dismissed the first-run welcome modal.
-- Previously "seen" lived only in localStorage (per-device), so the welcome
-- re-appeared on a new browser/device within the onboarding eligibility window.
-- NULL = not yet seen; a timestamp = dismissed.
--
-- Writability: the owning user can set it via the existing self-update RLS policy
-- (`profiles FOR UPDATE USING (auth.uid() = id)`), and this column is NOT in the
-- `profiles_block_privilege_column_updates` denylist, so a client update of just
-- this column is permitted while identity/privilege columns stay protected.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS onboarding_welcome_seen_at timestamptz;
