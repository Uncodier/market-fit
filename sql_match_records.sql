-- Function to find vectorially related records
CREATE OR REPLACE FUNCTION match_records_vector(
  query_record_id uuid,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  similarity float,
  category_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;
