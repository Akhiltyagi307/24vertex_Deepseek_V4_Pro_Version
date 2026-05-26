-- Add provider + reasoning/cache token columns to ai_calls.
--
-- Background: switching the LLM backend from OpenAI to DeepSeek V4 Pro
-- introduces (a) a second provider that needs to be sliceable in dashboards,
-- (b) a separate "reasoning_content" token bucket that DeepSeek bills as
-- output but is operationally distinct, and (c) DeepSeek's prompt-cache
-- hit/miss split which materially changes input-token cost (cache-hit input
-- is ~120x cheaper than cache-miss input on V4 Pro).
--
-- All new columns are nullable so the existing OpenAI rows backfill cleanly
-- and the structured-output-adapter writes only fields it actually has.

ALTER TABLE ai_calls
  ADD COLUMN IF NOT EXISTS reasoning_tokens integer,
  ADD COLUMN IF NOT EXISTS cache_hit_tokens integer,
  ADD COLUMN IF NOT EXISTS cache_miss_tokens integer,
  ADD COLUMN IF NOT EXISTS provider varchar(32);

CREATE INDEX IF NOT EXISTS idx_ai_calls_provider_created
  ON ai_calls (provider, created_at DESC);
