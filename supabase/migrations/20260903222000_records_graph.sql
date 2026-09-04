-- Migration to support graph view with vector similarity and HNSW index

-- 1. Index for fast nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_records_embedding_hnsw 
ON public.records 
USING hnsw (embedding vector_cosine_ops);

-- 2. Ensure match_records_vector is defined (for local graph/relations tab)
CREATE OR REPLACE FUNCTION public.match_records_vector(query_record_id uuid, match_threshold double precision, match_count integer)
 RETURNS TABLE(id uuid, title text, description text, similarity double precision, category_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  q_embedding vector(1536);
  q_site_id uuid;
BEGIN
  -- Get the embedding and site_id of the target record
  SELECT embedding, site_id INTO q_embedding, q_site_id
  FROM records
  WHERE records.id = query_record_id;

  IF q_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.title,
    r.description,
    1 - (r.embedding <=> q_embedding) AS similarity,
    c.name as category_name
  FROM records r
  LEFT JOIN record_categories c ON r.category_id = c.id
  WHERE r.embedding IS NOT NULL
    AND r.site_id = q_site_id
    AND r.id != query_record_id
    AND 1 - (r.embedding <=> q_embedding) > match_threshold
  ORDER BY r.embedding <=> q_embedding
  LIMIT match_count;
END;
$function$;

-- 3. Batch RPC to get similarity edges for the entire site (for global graph view)
CREATE OR REPLACE FUNCTION public.get_records_similarity_edges(p_site_id uuid, match_threshold double precision, match_per_record integer)
 RETURNS TABLE(source_id uuid, target_id uuid, similarity double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    r1.id as source_id,
    r2.id as target_id,
    1 - (r1.embedding <=> r2.embedding) as similarity
  FROM records r1
  CROSS JOIN LATERAL (
    SELECT id, embedding
    FROM records
    WHERE site_id = p_site_id
      AND embedding IS NOT NULL
      AND id > r1.id -- To avoid A->B and B->A, only get pairs once
      AND 1 - (r1.embedding <=> embedding) > match_threshold
    ORDER BY r1.embedding <=> embedding
    LIMIT match_per_record
  ) r2
  WHERE r1.site_id = p_site_id
    AND r1.embedding IS NOT NULL;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.match_records_vector(uuid, double precision, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_records_similarity_edges(uuid, double precision, integer) TO authenticated, service_role;