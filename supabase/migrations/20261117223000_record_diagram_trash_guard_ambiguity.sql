BEGIN;

-- records.source_id is an external reference, not the diagram's record UUID.
-- Use a distinct variable and qualified columns without changing trash guards.
CREATE OR REPLACE FUNCTION public.guard_trashed_record_diagram_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_record_id uuid; v_site_id uuid;
BEGIN
  v_record_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.record_id ELSE NEW.record_id END;
  SELECT r.site_id INTO v_site_id FROM public.records AS r WHERE r.id = v_record_id;
  PERFORM pg_advisory_xact_lock(hashtextextended('records-trash:' || v_site_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.records r WHERE r.id = v_record_id AND r.deleted_at IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.records r
      WHERE r.id = OLD.record_id AND r.deleted_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'Trashed record diagrams are read-only until restored' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_trashed_record_diagram_write() FROM PUBLIC, anon, authenticated;

COMMIT;