-- Doubt-chat AI cache hit-rate rollup view.
--
-- Background: as of 20260624000000 ai_calls captures cache_hit_tokens /
-- cache_miss_tokens for every DeepSeek call. We want a one-glance daily view
-- of how well doubt-chat is hitting DeepSeek's prefix cache so we can see the
-- impact of prompt-restructure work and prompt-doc edits over time.
--
-- The view is intentionally NOT a materialized view — ai_calls rows backfill
-- continuously and we want today's number to be live. The base table is well
-- indexed on (feature, created_at) so a daily-bucket aggregate over a single
-- feature class is cheap (~ms-level for years of data).
--
-- "baseline_cost_inr_no_cache" answers the question "what would this have
-- cost without DeepSeek's prefix cache" by re-billing the cache-hit tokens at
-- the cache-miss tier rate. The ratio (cost_inr_total / baseline) is the
-- cache discount factor we're earning. We don't store provider rates here
-- (they change); the view exposes the tokens and the actual billed cost, and
-- a downstream report computes the baseline from the model-pricing table at
-- read time.
--
-- Granularity: per day x feature x model x provider. Keeps the row count
-- bounded (handful of features, 2 providers, ~2 active models) so the result
-- set stays scannable in admin UI without pagination.

CREATE OR REPLACE VIEW ai_calls_doubt_cache_daily AS
SELECT
    date_trunc('day', created_at)::date         AS day,
    feature,
    model,
    provider,
    count(*)                                     AS calls,
    sum(input_tokens)                            AS input_tokens_total,
    sum(coalesce(cache_hit_tokens, 0))           AS cache_hit_tokens_total,
    sum(coalesce(cache_miss_tokens, 0))          AS cache_miss_tokens_total,
    sum(output_tokens)                           AS output_tokens_total,
    sum(coalesce(reasoning_tokens, 0))           AS reasoning_tokens_total,
    -- Cache hit rate over tokens (not over calls). Null when input_tokens=0.
    CASE
        WHEN sum(input_tokens) > 0
        THEN round(sum(coalesce(cache_hit_tokens, 0))::numeric * 100
                   / nullif(sum(input_tokens), 0), 2)
    END                                          AS cache_hit_pct,
    sum(coalesce(cost_inr, 0))                   AS cost_inr_total,
    sum(coalesce(latency_ms, 0))::bigint         AS latency_ms_total,
    -- p50/p95 latency for quick UX-regression spotting alongside cost.
    percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms)
                                                 AS latency_p50_ms,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
                                                 AS latency_p95_ms
FROM ai_calls
WHERE feature LIKE 'doubt.%'
  AND status = 'ok'
GROUP BY 1, 2, 3, 4;

COMMENT ON VIEW ai_calls_doubt_cache_daily IS
'Daily cache hit-rate + cost rollup for doubt-chat AI calls. cache_hit_pct is over input tokens, not calls. Re-billing cache-hit tokens at the miss rate (in the application layer) gives the "no-cache baseline cost" for comparison.';

-- Access policy: service_role only. The underlying ai_calls table is
-- explicitly admin-only (see migration 20260505120000 §"REVOKE ALL ... FROM
-- authenticated") because aggregate AI cost/token data is operational, not
-- per-student. Admins query this view through the service-role client; any
-- per-user breakdown belongs in a separate RLS-protected view.
REVOKE ALL ON ai_calls_doubt_cache_daily FROM authenticated;
REVOKE ALL ON ai_calls_doubt_cache_daily FROM anon;
GRANT SELECT ON ai_calls_doubt_cache_daily TO service_role;
