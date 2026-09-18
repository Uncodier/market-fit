ALTER TABLE public.record_diagram_nodes
  DROP CONSTRAINT IF EXISTS record_diagram_nodes_kind_check;

ALTER TABLE public.record_diagram_nodes
  ADD CONSTRAINT record_diagram_nodes_kind_check
  CHECK (kind = ANY (ARRAY[
    'title', 'description', 'note', 'concept', 'question', 'decision',
    'source', 'process', 'data', 'database', 'terminator'
  ]));
