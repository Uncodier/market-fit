CREATE INDEX IF NOT EXISTS requirement_status_instance_created_id_idx
  ON public.requirement_status (instance_id, created_at ASC, id ASC);
