-- Batch-update question embeddings in one round trip (service role only).

CREATE OR REPLACE FUNCTION public.practice_upsert_question_embeddings(p_rows jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
	UPDATE public.questions AS q
	SET embedding = v.emb::vector
	FROM (
		SELECT (elem->>'question_id')::uuid AS qid, elem->>'embedding' AS emb
		FROM jsonb_array_elements(
			CASE
				WHEN p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN '[]'::jsonb
				ELSE p_rows
			END
		) AS elem
		WHERE elem ? 'question_id'
		  AND elem ? 'embedding'
		  AND (elem->>'embedding') IS NOT NULL
		  AND length(trim(elem->>'embedding')) > 0
	) AS v(qid, emb)
	WHERE q.id = v.qid;
$$;

REVOKE ALL ON FUNCTION public.practice_upsert_question_embeddings(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.practice_upsert_question_embeddings(jsonb) TO service_role;
