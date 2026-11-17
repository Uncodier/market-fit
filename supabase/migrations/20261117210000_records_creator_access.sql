BEGIN;
SET LOCAL lock_timeout = '5s';

-- Never infer historical creators from relations, category or site ownership.
ALTER TABLE public.records ADD COLUMN created_by_user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.records ALTER COLUMN created_by_user_id SET DEFAULT auth.uid();
CREATE INDEX records_site_creator_idx ON public.records(site_id, created_by_user_id);

CREATE FUNCTION public.guard_record_creator()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id THEN
      RAISE EXCEPTION 'Record creator is immutable' USING ERRCODE = '42501';
    END IF;
  ELSIF current_setting('role', true) IN ('authenticated', 'anon') THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Record creation requires authentication' USING ERRCODE = '42501';
    END IF;
    NEW.created_by_user_id := coalesce(NEW.created_by_user_id, auth.uid());
    IF NEW.created_by_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Record creator must match the actor' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_record_creator() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER records_creator_guard BEFORE INSERT OR UPDATE ON public.records
FOR EACH ROW EXECUTE FUNCTION public.guard_record_creator();

CREATE FUNCTION public.record_row_access(p_site uuid, p_creator uuid, p_relations jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sites s WHERE s.id = p_site AND (
      s.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.site_ownership so
        WHERE so.site_id = s.id AND so.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = auth.uid() AND sm.status = 'active'
          AND (NOT coalesce(sm.restrict_to_assigned_only, false)
            OR p_creator = auth.uid()
            -- Keep exact top-level assignments, not UUID substrings in JSON keys/text.
            OR EXISTS (SELECT 1 FROM jsonb_each(
              CASE WHEN jsonb_typeof(p_relations) = 'object' THEN p_relations ELSE '{}'::jsonb END
            ) link WHERE link.value = to_jsonb(auth.uid()::text))))
    )
  );
$$;
REVOKE ALL ON FUNCTION public.record_row_access(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_row_access(uuid, uuid, jsonb) TO authenticated;

-- Replace only record ownership policies. Existing location/trash guards remain.
-- Restrictive companions prevent other permissive policies bypassing ownership.
DO $$
DECLARE operation text; predicate text;
BEGIN
  FOREACH operation IN ARRAY ARRAY['select', 'insert', 'update', 'delete'] LOOP
    predicate := format('public.user_can(site_id, %L) IS TRUE AND public.record_row_access(site_id, created_by_user_id, relations)', operation);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.records', 'records_' || operation);
    EXECUTE format('CREATE POLICY %I ON public.records FOR %s TO authenticated %s %s',
      'records_' || operation, upper(operation),
      CASE WHEN operation <> 'insert' THEN 'USING (' || predicate || ')' ELSE '' END,
      CASE WHEN operation IN ('insert', 'update') THEN 'WITH CHECK (' || predicate || ')' ELSE '' END);
    EXECUTE format('CREATE POLICY %I ON public.records AS RESTRICTIVE FOR %s TO authenticated %s %s',
      'records_ownership_' || operation, upper(operation),
      CASE WHEN operation <> 'insert' THEN 'USING (' || predicate || ')' ELSE '' END,
      CASE WHEN operation IN ('insert', 'update') THEN 'WITH CHECK (' || predicate || ')' ELSE '' END);
  END LOOP;
END;
$$;

-- Creator is database-owned: do not expand existing column-level write grants.
NOTIFY pgrst, 'reload schema';
COMMIT;