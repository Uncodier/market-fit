BEGIN;

CREATE INDEX IF NOT EXISTS instance_nodes_instance_created_id_idx
  ON public.instance_nodes (
    instance_id,
    created_at ASC,
    id ASC
  );

CREATE INDEX IF NOT EXISTS instance_node_contexts_context_node_id_idx
  ON public.instance_node_contexts (context_node_id);

COMMIT;
