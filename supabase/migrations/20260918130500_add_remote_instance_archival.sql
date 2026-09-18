BEGIN;

ALTER TABLE public.remote_instances
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.remote_instances.is_archived IS
'Controls whether the instance is hidden from active application surfaces without changing its runtime status.';

CREATE INDEX IF NOT EXISTS idx_remote_instances_site_active_updated
ON public.remote_instances (site_id, updated_at DESC)
WHERE is_archived = false;

COMMIT;
