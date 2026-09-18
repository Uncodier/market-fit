-- Retrieval and revision-guarded embedding writes for record diagrams.

CREATE OR REPLACE FUNCTION public.match_record_diagram_nodes(
  query_embedding vector(1536),
  p_site_id uuid,
  p_record_id uuid DEFAULT NULL,
  match_threshold double precision DEFAULT 0.5,
  match_count integer DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  record_id uuid,
  kind text,
  title text,
  content text,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.record_id,
    n.kind,
    n.title,
    n.content,
    1 - (n.embedding <=> query_embedding) AS similarity
  FROM public.record_diagram_nodes n
  WHERE n.site_id = p_site_id
    AND (p_record_id IS NULL OR n.record_id = p_record_id)
    AND n.embedding IS NOT NULL
    AND 1 - (n.embedding <=> query_embedding) > match_threshold
  ORDER BY n.embedding <=> query_embedding
  LIMIT GREATEST(1, LEAST(COALESCE(match_count, 10), 200));
$$;

REVOKE ALL ON FUNCTION public.match_record_diagram_nodes(
  vector, uuid, uuid, double precision, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_record_diagram_nodes(
  vector, uuid, uuid, double precision, integer
) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_record_diagram_context(uuid);
CREATE OR REPLACE FUNCTION public.get_record_diagram_context(
  p_record_id uuid,
  p_node_limit integer DEFAULT 100,
  p_content_limit integer DEFAULT 4000,
  p_edge_limit integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH target_record AS (
    SELECT r.id, r.title, r.category_id
    FROM public.records r
    WHERE r.id = p_record_id
  ),
  bounded_nodes AS (
    SELECT n.*
    FROM public.record_diagram_nodes n
    WHERE n.record_id = p_record_id
    ORDER BY n.id
    LIMIT GREATEST(1, LEAST(COALESCE(p_node_limit, 100), 100))
  ),
  bounded_edges AS (
    SELECT e.*
    FROM public.record_diagram_edges e
    WHERE e.record_id = p_record_id
      AND e.source_node_id IN (SELECT id FROM bounded_nodes)
      AND e.target_node_id IN (SELECT id FROM bounded_nodes)
    ORDER BY e.id
    LIMIT GREATEST(0, LEAST(COALESCE(p_edge_limit, 200), 200))
  )
  SELECT jsonb_build_object(
    'schema', 'record-diagram.v1',
    'record', jsonb_build_object(
      'id', r.id,
      'title', r.title,
      'category', c.name
    ),
    'nodes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', n.id,
        'kind', n.kind,
        'title', n.title,
        'content', left(
          n.content,
          GREATEST(100, LEAST(COALESCE(p_content_limit, 4000), 4000))
        ),
        'metadata', n.metadata
      ) ORDER BY n.id)
      FROM bounded_nodes n
    ), '[]'::jsonb),
    'edges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id,
        'source', e.source_node_id,
        'target', e.target_node_id,
        'type', e.relation_type,
        'label', e.label,
        'metadata', e.metadata
      ) ORDER BY e.id)
      FROM bounded_edges e
    ), '[]'::jsonb)
  )
  FROM target_record r
  LEFT JOIN public.record_categories c ON c.id = r.category_id
  ;
$$;

REVOKE ALL ON FUNCTION public.get_record_diagram_context(uuid, integer, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_record_diagram_context(uuid, integer, integer, integer)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_record_diagram_neighborhood(
  p_node_ids uuid[],
  p_neighbor_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH requested AS (
    SELECT unnest(p_node_ids[1:50]) AS id
  ),
  neighborhood_edges AS (
    SELECT e.*
    FROM public.record_diagram_edges e
    WHERE e.source_node_id IN (SELECT id FROM requested)
       OR e.target_node_id IN (SELECT id FROM requested)
    ORDER BY e.id
    LIMIT GREATEST(1, LEAST(COALESCE(p_neighbor_limit, 100) * 2, 200))
  ),
  neighborhood_node_ids AS (
    SELECT id FROM requested
    UNION
    SELECT source_node_id FROM neighborhood_edges
    UNION
    SELECT target_node_id FROM neighborhood_edges
  ),
  neighborhood_nodes AS (
    SELECT n.*
    FROM public.record_diagram_nodes n
    WHERE n.id IN (SELECT id FROM neighborhood_node_ids)
    ORDER BY n.id
    LIMIT GREATEST(1, LEAST(COALESCE(p_neighbor_limit, 100), 100))
  )
  SELECT jsonb_build_object(
    'schema', 'record-diagram-neighborhood.v1',
    'nodes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', n.id,
        'recordId', n.record_id,
        'kind', n.kind,
        'title', n.title,
        'content', n.content,
        'metadata', n.metadata,
        'matched', n.id IN (SELECT id FROM requested)
      ) ORDER BY n.id)
      FROM neighborhood_nodes n
    ), '[]'::jsonb),
    'edges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id,
        'recordId', e.record_id,
        'source', e.source_node_id,
        'target', e.target_node_id,
        'type', e.relation_type,
        'label', e.label,
        'metadata', e.metadata
      ) ORDER BY e.id)
      FROM neighborhood_edges e
      WHERE e.source_node_id IN (SELECT id FROM neighborhood_nodes)
        AND e.target_node_id IN (SELECT id FROM neighborhood_nodes)
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.get_record_diagram_neighborhood(uuid[], integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_record_diagram_neighborhood(uuid[], integer)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_record_embedding_jobs(
  p_record_id uuid,
  p_limit integer DEFAULT 5
)
RETURNS SETOF public.record_embedding_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
    FROM public.record_embedding_jobs j
    WHERE j.record_id = p_record_id
      AND j.attempts < 5
      AND (
        j.status IN ('pending', 'failed')
        OR (
          j.status = 'processing'
          AND j.claimed_at < now() - interval '10 minutes'
        )
      )
    ORDER BY j.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 5), 10))
  )
  UPDATE public.record_embedding_jobs j
  SET
    status = 'processing',
    attempts = j.attempts + 1,
    claimed_at = now(),
    last_error = NULL,
    updated_at = now()
  FROM candidates
  WHERE j.id = candidates.id
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_record_embedding_jobs(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_record_embedding_jobs(uuid, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_record_embedding_job(
  p_record_id uuid,
  p_node_ids uuid[] DEFAULT '{}'::uuid[],
  p_replace boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_site_id uuid;
  v_revision bigint;
  v_record_revision bigint;
BEGIN
  SELECT r.site_id, COALESCE(d.revision, 0), r.record_embedding_revision
  INTO v_site_id, v_revision, v_record_revision
  FROM public.records r
  LEFT JOIN public.record_diagrams d ON d.record_id = r.id
  WHERE r.id = p_record_id;

  IF v_site_id IS NULL THEN
    RAISE EXCEPTION 'Record not found';
  END IF;

  INSERT INTO public.record_embedding_jobs(
    record_id,
    site_id,
    diagram_revision,
    record_revision,
    node_ids,
    status,
    attempts,
    last_error,
    claimed_at,
    completed_at,
    updated_at
  )
  VALUES (
    p_record_id,
    v_site_id,
    v_revision,
    v_record_revision,
    COALESCE(p_node_ids, '{}'::uuid[]),
    'pending',
    0,
    NULL,
    NULL,
    NULL,
    now()
  )
  ON CONFLICT (record_id, diagram_revision, record_revision) DO UPDATE SET
    node_ids = CASE
      WHEN p_replace AND record_embedding_jobs.status = 'processing'
        THEN EXCLUDED.node_ids
      ELSE ARRAY(
        SELECT DISTINCT node_id
        FROM unnest(
          record_embedding_jobs.node_ids || EXCLUDED.node_ids
        ) AS ids(node_id)
      )
    END,
    status = 'pending',
    attempts = 0,
    last_error = NULL,
    claimed_at = NULL,
    completed_at = NULL,
    updated_at = now()
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_record_embedding_job(uuid, uuid[], boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_record_embedding_job(uuid, uuid[], boolean)
  TO service_role;

CREATE OR REPLACE FUNCTION public.bump_record_embedding_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.title IS DISTINCT FROM NEW.title
    OR OLD.description IS DISTINCT FROM NEW.description
    OR OLD.category_id IS DISTINCT FROM NEW.category_id
    OR OLD.data IS DISTINCT FROM NEW.data
    OR OLD.relations IS DISTINCT FROM NEW.relations
    OR OLD.status IS DISTINCT FROM NEW.status
  THEN
    NEW.record_embedding_revision := OLD.record_embedding_revision + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bump_record_embedding_revision ON public.records;
CREATE TRIGGER bump_record_embedding_revision
BEFORE UPDATE OF title, description, category_id, data, relations, status
ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.bump_record_embedding_revision();

CREATE OR REPLACE FUNCTION public.queue_record_embedding_on_record_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_node_ids uuid[] := '{}'::uuid[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.record_embedding_revision = NEW.record_embedding_revision THEN
      RETURN NEW;
    END IF;

    IF
      OLD.title IS DISTINCT FROM NEW.title
      OR OLD.category_id IS DISTINCT FROM NEW.category_id
    THEN
      SELECT COALESCE(array_agg(n.id), '{}'::uuid[])
      INTO v_node_ids
      FROM public.record_diagram_nodes n
      WHERE n.record_id = NEW.id;
    END IF;
  END IF;

  PERFORM public.enqueue_record_embedding_job(NEW.id, v_node_ids, false);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_record_embedding_on_record_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS queue_record_embedding_on_record_change
  ON public.records;
CREATE TRIGGER queue_record_embedding_on_record_change
AFTER INSERT OR UPDATE OF title, description, category_id, data, relations, status
ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.queue_record_embedding_on_record_change();

CREATE OR REPLACE FUNCTION public.save_record_diagram_node_embedding(
  p_record_id uuid,
  p_node_id uuid,
  p_diagram_revision bigint,
  p_record_revision bigint,
  p_embedding_source_hash text,
  p_new_embedding_source_hash text,
  p_embedding vector(1536),
  p_embedding_model text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.record_diagram_nodes n
  SET
    embedding = p_embedding,
    embedding_source_hash = p_new_embedding_source_hash,
    embedding_model = p_embedding_model,
    embedding_updated_at = now()
  WHERE n.id = p_node_id
    AND n.record_id = p_record_id
    AND n.embedding_source_hash IS NOT DISTINCT FROM p_embedding_source_hash
    AND EXISTS (
      SELECT 1
      FROM public.records r
      WHERE r.id = p_record_id
        AND r.record_embedding_revision = p_record_revision
    )
    AND EXISTS (
      SELECT 1
      FROM public.record_diagrams d
      WHERE d.record_id = p_record_id
        AND d.revision = p_diagram_revision
    );

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.save_record_diagram_node_embedding(
  uuid, uuid, bigint, bigint, text, text, vector, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_record_diagram_node_embedding(
  uuid, uuid, bigint, bigint, text, text, vector, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.save_record_aggregate_embedding(
  p_record_id uuid,
  p_diagram_revision bigint,
  p_record_revision bigint,
  p_summary text,
  p_embedding vector(1536)
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.records r
  SET summary = p_summary, embedding = p_embedding, updated_at = now()
  WHERE r.id = p_record_id
    AND r.record_embedding_revision = p_record_revision
    AND (
      EXISTS (
        SELECT 1
        FROM public.record_diagrams d
        WHERE d.record_id = p_record_id
          AND d.revision = p_diagram_revision
      )
      OR (
        p_diagram_revision = 0
        AND NOT EXISTS (
          SELECT 1 FROM public.record_diagrams d WHERE d.record_id = p_record_id
        )
      )
    );

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.save_record_aggregate_embedding(
  uuid, bigint, bigint, text, vector
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_record_aggregate_embedding(
  uuid, bigint, bigint, text, vector
) TO service_role;

-- Existing similarity functions must respect record RLS and must not be public.
ALTER FUNCTION public.match_records_vector(uuid, double precision, integer) SECURITY INVOKER;
ALTER FUNCTION public.get_records_similarity_edges(uuid, double precision, integer) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.match_records_vector(uuid, double precision, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_records_similarity_edges(uuid, double precision, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_records_vector(uuid, double precision, integer)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_records_similarity_edges(uuid, double precision, integer)
  TO authenticated, service_role;
