BEGIN;
-- Canonical diagram_retrieval made these invoker functions. Never silently
-- change a deployed definer/location wrapper: its private body may require that
-- boundary. Unexpected deployments need review before active-only RLS is relied on.
DO $$
DECLARE signature text; function_id regprocedure;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.match_records_vector(uuid,double precision,integer)',
    'public.get_records_similarity_edges(uuid,double precision,integer)'
  ] LOOP
    function_id := to_regprocedure(signature);
    IF function_id IS NULL OR EXISTS (SELECT 1 FROM pg_proc WHERE oid = function_id AND prosecdef) THEN
      RAISE EXCEPTION 'Records retrieval boundary review required: % must exist as SECURITY INVOKER', signature;
    END IF;
  END LOOP;
END;
$$;

-- Cancel stale queued work without removing the saved diagrams or embeddings.
-- In-flight workers still must recheck deleted_at before external work and saves.
CREATE FUNCTION public.cancel_trashed_record_embedding_jobs() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.record_embedding_jobs SET status = 'completed',
      completed_at = transaction_timestamp(), updated_at = transaction_timestamp(),
      last_error = 'Record moved to trash'
      WHERE record_id = NEW.id AND status IN ('pending', 'failed', 'processing');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_trashed_record_embedding_jobs() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cancel_trashed_record_embedding_jobs AFTER UPDATE OF deleted_at ON public.records
  FOR EACH ROW EXECUTE FUNCTION public.cancel_trashed_record_embedding_jobs();

-- Any enqueue path (including privileged diagram writers) must serialize with
-- trash before admitting work. Finished historical jobs remain untouched.
CREATE FUNCTION public.guard_trashed_record_embedding_job() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status IN ('pending', 'processing', 'failed') THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('records-trash:' || NEW.site_id::text, 0));
    IF EXISTS (SELECT 1 FROM public.records r WHERE r.id = NEW.record_id AND r.deleted_at IS NOT NULL) THEN
      NEW.status := 'completed';
      NEW.completed_at := transaction_timestamp();
      NEW.last_error := 'Record moved to trash';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_trashed_record_embedding_job() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_trashed_record_embedding_job BEFORE INSERT OR UPDATE ON public.record_embedding_jobs
  FOR EACH ROW EXECUTE FUNCTION public.guard_trashed_record_embedding_job();

-- Saved diagrams and their nodes/edges are retained, but no privileged worker or
-- diagram RPC may rewrite their content while the source record is trashed.
CREATE FUNCTION public.guard_trashed_record_diagram_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE source_id uuid; source_site uuid;
BEGIN
  source_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.record_id ELSE NEW.record_id END;
  SELECT site_id INTO source_site FROM public.records WHERE id = source_id;
  PERFORM pg_advisory_xact_lock(hashtextextended('records-trash:' || source_site::text, 0));
  IF EXISTS (SELECT 1 FROM public.records r WHERE r.id = source_id AND r.deleted_at IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.records r
      WHERE r.id = OLD.record_id AND r.deleted_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'Trashed record diagrams are read-only until restored' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_trashed_record_diagram_write() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER record_diagram_trash_guard BEFORE INSERT OR UPDATE OR DELETE ON public.record_diagrams
  FOR EACH ROW EXECUTE FUNCTION public.guard_trashed_record_diagram_write();
CREATE TRIGGER record_diagram_node_trash_guard BEFORE INSERT OR UPDATE OR DELETE ON public.record_diagram_nodes
  FOR EACH ROW EXECUTE FUNCTION public.guard_trashed_record_diagram_write();
CREATE TRIGGER record_diagram_edge_trash_guard BEFORE INSERT OR UPDATE OR DELETE ON public.record_diagram_edges
  FOR EACH ROW EXECUTE FUNCTION public.guard_trashed_record_diagram_write();
COMMIT;