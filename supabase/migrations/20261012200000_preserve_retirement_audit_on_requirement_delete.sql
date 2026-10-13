-- Makinari only, not Apps. Requires the API's legacy retirement migration.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Immutable retirement receipts outlive their requirement and lifecycle. Keep
-- their historical identifiers/snapshots, append-only trigger, ACL and RLS.
-- The private retirement RPC still locks and validates live parents on insert.
-- The instance FK is deliberately unchanged; instance deletion is separate.
ALTER TABLE public.requirement_migration_retirements
  DROP CONSTRAINT IF EXISTS requirement_migration_retirements_requirement_id_fkey,
  DROP CONSTRAINT IF EXISTS requirement_migration_retirements_requirement_id_file_fkey;

COMMENT ON COLUMN public.requirement_migration_retirements.requirement_id IS
  'Historical requirement identifier retained unchanged after authorized requirement deletion.';

-- Restore the root-delete exception lost by the retirement-aware replacement.
-- Preserve all receipt matching and live-lifecycle immutability checks.
CREATE OR REPLACE FUNCTION public.guard_migration_execution_handoff()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM public.requirements WHERE id = OLD.requirement_id
  ) THEN
    RETURN NULL;
  END IF;
  IF TG_OP <> 'INSERT' AND (OLD.state = 'transferred' OR EXISTS (
    SELECT 1 FROM public.requirement_migration_execution_handoffs h
    WHERE h.requirement_id = OLD.requirement_id AND h.file = OLD.file
  ) OR EXISTS (
    SELECT 1 FROM public.requirement_migration_retirements h
    WHERE h.requirement_id = OLD.requirement_id AND h.file = OLD.file
  )) THEN
    IF TG_OP <> 'UPDATE' OR OLD.state = 'transferred' OR NEW.state <> 'transferred' THEN
      RAISE EXCEPTION 'Transferred migration lifecycle is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.state = 'transferred' THEN
    IF TG_OP <> 'UPDATE' OR NOT public.migration_execution_handoff_matches(NEW)
      OR NOT (EXISTS (
        SELECT 1 FROM public.requirement_migration_execution_handoffs h
        WHERE h.requirement_id = NEW.requirement_id AND h.file = NEW.file
          AND h.prior_lifecycle = to_jsonb(OLD)
      ) OR EXISTS (
        SELECT 1 FROM public.requirement_migration_retirements h
        WHERE h.requirement_id = NEW.requirement_id AND h.file = NEW.file
          AND h.prior_lifecycle = to_jsonb(OLD)
      )) THEN
      RAISE EXCEPTION 'Transferred migration requires its matching immutable receipt' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_migration_execution_handoff()
  FROM PUBLIC, anon, authenticated, service_role;
COMMIT;