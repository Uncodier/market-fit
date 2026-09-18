-- Editable, machine-readable diagrams attached to records.

ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS record_embedding_revision bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.record_diagrams (
  record_id uuid PRIMARY KEY REFERENCES public.records(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0,
  viewport jsonb NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT record_diagrams_record_site_uidx UNIQUE (record_id, site_id),
  CONSTRAINT record_diagrams_viewport_object_check CHECK (jsonb_typeof(viewport) = 'object')
);

CREATE TABLE IF NOT EXISTS public.record_diagram_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL,
  site_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'note',
  title text NOT NULL DEFAULT 'Untitled',
  content text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  position_x double precision NOT NULL DEFAULT 80,
  position_y double precision NOT NULL DEFAULT 80,
  embedding vector(1536),
  embedding_source_hash text,
  embedding_model text,
  embedding_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT record_diagram_nodes_record_site_fkey
    FOREIGN KEY (record_id, site_id)
    REFERENCES public.record_diagrams(record_id, site_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT record_diagram_nodes_record_id_id_uidx UNIQUE (record_id, id),
  CONSTRAINT record_diagram_nodes_kind_check
    CHECK (kind = ANY (ARRAY[
      'note', 'concept', 'question', 'decision', 'source',
      'process', 'data', 'database', 'terminator'
    ])),
  CONSTRAINT record_diagram_nodes_title_length_check
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 240),
  CONSTRAINT record_diagram_nodes_content_length_check CHECK (char_length(content) <= 12000),
  CONSTRAINT record_diagram_nodes_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.record_diagram_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL,
  site_id uuid NOT NULL,
  source_node_id uuid NOT NULL,
  target_node_id uuid NOT NULL,
  relation_type text NOT NULL DEFAULT 'relates_to',
  label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT record_diagram_edges_record_site_fkey
    FOREIGN KEY (record_id, site_id)
    REFERENCES public.record_diagrams(record_id, site_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT record_diagram_edges_source_fkey
    FOREIGN KEY (record_id, source_node_id)
    REFERENCES public.record_diagram_nodes(record_id, id)
    ON DELETE CASCADE,
  CONSTRAINT record_diagram_edges_target_fkey
    FOREIGN KEY (record_id, target_node_id)
    REFERENCES public.record_diagram_nodes(record_id, id)
    ON DELETE CASCADE,
  CONSTRAINT record_diagram_edges_distinct_nodes_check CHECK (source_node_id <> target_node_id),
  CONSTRAINT record_diagram_edges_type_check
    CHECK (relation_type = ANY (ARRAY[
      'relates_to', 'supports', 'contradicts', 'causes', 'contains', 'references'
    ])),
  CONSTRAINT record_diagram_edges_label_length_check CHECK (char_length(label) <= 120),
  CONSTRAINT record_diagram_edges_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT record_diagram_edges_unique_semantic_link
    UNIQUE (record_id, source_node_id, target_node_id, relation_type)
);

CREATE TABLE IF NOT EXISTS public.record_embedding_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.records(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  diagram_revision bigint NOT NULL,
  record_revision bigint NOT NULL DEFAULT 0,
  node_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT record_embedding_jobs_status_check
    CHECK (status = ANY (ARRAY['pending', 'processing', 'completed', 'failed'])),
  CONSTRAINT record_embedding_jobs_revision_uidx
    UNIQUE (record_id, diagram_revision, record_revision)
);

ALTER TABLE public.record_embedding_jobs
  ADD COLUMN IF NOT EXISTS record_revision bigint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_record_diagram_nodes_record
  ON public.record_diagram_nodes(record_id);
CREATE INDEX IF NOT EXISTS idx_record_diagram_nodes_site
  ON public.record_diagram_nodes(site_id);
CREATE INDEX IF NOT EXISTS idx_record_diagram_edges_record
  ON public.record_diagram_edges(record_id);
CREATE INDEX IF NOT EXISTS idx_record_diagram_edges_source
  ON public.record_diagram_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_record_diagram_edges_target
  ON public.record_diagram_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_record_embedding_jobs_pending
  ON public.record_embedding_jobs(status, created_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_record_diagram_nodes_embedding_hnsw
  ON public.record_diagram_nodes
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.record_diagrams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_diagram_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_diagram_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_embedding_jobs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_record_diagram(
  p_record_id uuid,
  p_site_id uuid,
  p_command text DEFAULT 'select'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    public.user_can(p_site_id, p_command)
    AND EXISTS (
      SELECT 1
      FROM public.records r
      WHERE r.id = p_record_id
        AND r.site_id = p_site_id
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_record_diagram(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_record_diagram(uuid, uuid, text)
  TO authenticated, service_role;

DROP POLICY IF EXISTS record_diagrams_select ON public.record_diagrams;
CREATE POLICY record_diagrams_select ON public.record_diagrams
FOR SELECT TO authenticated
USING (public.can_access_record_diagram(record_id, site_id, 'select'));

DROP POLICY IF EXISTS record_diagrams_write ON public.record_diagrams;

DROP POLICY IF EXISTS record_diagram_nodes_select ON public.record_diagram_nodes;
CREATE POLICY record_diagram_nodes_select ON public.record_diagram_nodes
FOR SELECT TO authenticated
USING (public.can_access_record_diagram(record_id, site_id, 'select'));

DROP POLICY IF EXISTS record_diagram_nodes_write ON public.record_diagram_nodes;

DROP POLICY IF EXISTS record_diagram_edges_select ON public.record_diagram_edges;
CREATE POLICY record_diagram_edges_select ON public.record_diagram_edges
FOR SELECT TO authenticated
USING (public.can_access_record_diagram(record_id, site_id, 'select'));

DROP POLICY IF EXISTS record_diagram_edges_write ON public.record_diagram_edges;

DROP POLICY IF EXISTS record_embedding_jobs_select ON public.record_embedding_jobs;
CREATE POLICY record_embedding_jobs_select ON public.record_embedding_jobs
FOR SELECT TO authenticated
USING (public.can_access_record_diagram(record_id, site_id, 'select'));

DROP POLICY IF EXISTS record_embedding_jobs_write ON public.record_embedding_jobs;

REVOKE ALL ON public.record_diagrams, public.record_diagram_nodes,
  public.record_diagram_edges, public.record_embedding_jobs FROM anon, authenticated;
GRANT SELECT ON public.record_diagrams, public.record_diagram_nodes,
  public.record_diagram_edges TO authenticated;
GRANT ALL ON public.record_diagrams, public.record_diagram_nodes,
  public.record_diagram_edges, public.record_embedding_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.save_record_diagram(
  p_record_id uuid,
  p_expected_revision bigint,
  p_viewport jsonb,
  p_nodes jsonb,
  p_edges jsonb
)
RETURNS TABLE(revision bigint, changed_node_ids uuid[])
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_site_id uuid;
  v_record_revision bigint;
  v_current_revision bigint;
  v_next_revision bigint;
  v_changed_node_ids uuid[] := '{}'::uuid[];
  v_old_edge_signature text;
  v_new_edge_signature text;
  v_old_node_ids uuid[];
  v_new_node_ids uuid[];
  v_semantic_changed boolean := false;
BEGIN
  IF jsonb_typeof(COALESCE(p_nodes, '[]'::jsonb)) <> 'array'
    OR jsonb_array_length(COALESCE(p_nodes, '[]'::jsonb)) > 200
    OR jsonb_typeof(COALESCE(p_edges, '[]'::jsonb)) <> 'array'
    OR jsonb_array_length(COALESCE(p_edges, '[]'::jsonb)) > 500
    OR jsonb_typeof(COALESCE(p_viewport, '{}'::jsonb)) <> 'object'
  THEN
    RAISE EXCEPTION 'Diagram payload exceeds its allowed shape or size';
  END IF;

  SELECT r.site_id, r.record_embedding_revision
  INTO v_site_id, v_record_revision
  FROM public.records r
  WHERE r.id = p_record_id;

  IF v_site_id IS NULL THEN
    RAISE EXCEPTION 'Record not found';
  END IF;

  INSERT INTO public.record_diagrams(record_id, site_id)
  VALUES (p_record_id, v_site_id)
  ON CONFLICT (record_id) DO NOTHING;

  SELECT d.revision
  INTO v_current_revision
  FROM public.record_diagrams d
  WHERE d.record_id = p_record_id
  FOR UPDATE;

  IF v_current_revision <> p_expected_revision THEN
    RAISE EXCEPTION 'Diagram revision conflict: expected %, current %',
      p_expected_revision, v_current_revision
      USING ERRCODE = '40001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(COALESCE(p_nodes, '[]'::jsonb)) AS input(id uuid)
    JOIN public.record_diagram_nodes existing ON existing.id = input.id
    WHERE existing.record_id <> p_record_id
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(COALESCE(p_edges, '[]'::jsonb)) AS input(id uuid)
    JOIN public.record_diagram_edges existing ON existing.id = input.id
    WHERE existing.record_id <> p_record_id
  ) THEN
    RAISE EXCEPTION 'Diagram IDs must be scoped to their original record';
  END IF;

  SELECT COALESCE(array_agg(n.id ORDER BY n.id), '{}'::uuid[])
  INTO v_old_node_ids
  FROM public.record_diagram_nodes n
  WHERE n.record_id = p_record_id;

  SELECT COALESCE(array_agg(input.id ORDER BY input.id), '{}'::uuid[])
  INTO v_new_node_ids
  FROM jsonb_to_recordset(COALESCE(p_nodes, '[]'::jsonb)) AS input(id uuid);

  SELECT COALESCE(array_agg(input.id ORDER BY input.id), '{}'::uuid[])
  INTO v_changed_node_ids
  FROM jsonb_to_recordset(COALESCE(p_nodes, '[]'::jsonb)) AS input(
    id uuid,
    embedding_source_hash text
  )
  LEFT JOIN public.record_diagram_nodes existing
    ON existing.record_id = p_record_id AND existing.id = input.id
  WHERE existing.id IS NULL
    OR existing.embedding_source_hash IS DISTINCT FROM input.embedding_source_hash;

  SELECT md5(COALESCE(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'source', e.source_node_id,
    'target', e.target_node_id,
    'type', e.relation_type,
    'label', e.label,
    'metadata', e.metadata
  ) ORDER BY e.id)::text, '[]'))
  INTO v_old_edge_signature
  FROM public.record_diagram_edges e
  WHERE e.record_id = p_record_id;

  SELECT md5(COALESCE(jsonb_agg(jsonb_build_object(
    'id', input.id,
    'source', input.source_node_id,
    'target', input.target_node_id,
    'type', input.relation_type,
    'label', input.label,
    'metadata', input.metadata
  ) ORDER BY input.id)::text, '[]'))
  INTO v_new_edge_signature
  FROM jsonb_to_recordset(COALESCE(p_edges, '[]'::jsonb)) AS input(
    id uuid,
    source_node_id uuid,
    target_node_id uuid,
    relation_type text,
    label text,
    metadata jsonb
  );

  INSERT INTO public.record_diagram_nodes(
    id, record_id, site_id, kind, title, content, metadata,
    position_x, position_y, embedding_source_hash
  )
  SELECT
    input.id, p_record_id, v_site_id, input.kind, input.title, input.content,
    COALESCE(input.metadata, '{}'::jsonb), input.position_x, input.position_y,
    input.embedding_source_hash
  FROM jsonb_to_recordset(COALESCE(p_nodes, '[]'::jsonb)) AS input(
    id uuid,
    kind text,
    title text,
    content text,
    metadata jsonb,
    position_x double precision,
    position_y double precision,
    embedding_source_hash text
  )
  ON CONFLICT (id) DO UPDATE SET
    kind = EXCLUDED.kind,
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    metadata = EXCLUDED.metadata,
    position_x = EXCLUDED.position_x,
    position_y = EXCLUDED.position_y,
    embedding = CASE
      WHEN record_diagram_nodes.embedding_source_hash = EXCLUDED.embedding_source_hash
        THEN record_diagram_nodes.embedding
      ELSE NULL
    END,
    embedding_model = CASE
      WHEN record_diagram_nodes.embedding_source_hash = EXCLUDED.embedding_source_hash
        THEN record_diagram_nodes.embedding_model
      ELSE NULL
    END,
    embedding_updated_at = CASE
      WHEN record_diagram_nodes.embedding_source_hash = EXCLUDED.embedding_source_hash
        THEN record_diagram_nodes.embedding_updated_at
      ELSE NULL
    END,
    embedding_source_hash = EXCLUDED.embedding_source_hash,
    updated_at = now();

  DELETE FROM public.record_diagram_nodes existing
  WHERE existing.record_id = p_record_id
    AND NOT (existing.id = ANY(v_new_node_ids));

  INSERT INTO public.record_diagram_edges(
    id, record_id, site_id, source_node_id, target_node_id,
    relation_type, label, metadata
  )
  SELECT
    input.id, p_record_id, v_site_id, input.source_node_id,
    input.target_node_id, input.relation_type, input.label,
    COALESCE(input.metadata, '{}'::jsonb)
  FROM jsonb_to_recordset(COALESCE(p_edges, '[]'::jsonb)) AS input(
    id uuid,
    source_node_id uuid,
    target_node_id uuid,
    relation_type text,
    label text,
    metadata jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    source_node_id = EXCLUDED.source_node_id,
    target_node_id = EXCLUDED.target_node_id,
    relation_type = EXCLUDED.relation_type,
    label = EXCLUDED.label,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  DELETE FROM public.record_diagram_edges existing
  WHERE existing.record_id = p_record_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(COALESCE(p_edges, '[]'::jsonb)) AS input(id uuid)
      WHERE input.id = existing.id
    );

  v_semantic_changed :=
    cardinality(v_changed_node_ids) > 0
    OR v_old_node_ids IS DISTINCT FROM v_new_node_ids
    OR v_old_edge_signature IS DISTINCT FROM v_new_edge_signature;
  v_next_revision := v_current_revision + 1;

  UPDATE public.record_diagrams
  SET
    revision = v_next_revision,
    viewport = COALESCE(p_viewport, viewport),
    updated_at = now()
  WHERE record_id = p_record_id;

  IF v_semantic_changed THEN
    INSERT INTO public.record_embedding_jobs(
      record_id, site_id, diagram_revision, record_revision, node_ids
    )
    VALUES (
      p_record_id, v_site_id, v_next_revision, v_record_revision, v_changed_node_ids
    )
    ON CONFLICT (record_id, diagram_revision, record_revision) DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_next_revision, v_changed_node_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.save_record_diagram(uuid, bigint, jsonb, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_record_diagram(uuid, bigint, jsonb, jsonb, jsonb)
  TO service_role;
