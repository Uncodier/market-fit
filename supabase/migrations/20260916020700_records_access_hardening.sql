-- Command-specific record/category access and tenant-consistent diagram keys.

ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS record_embedding_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.record_embedding_jobs
  ADD COLUMN IF NOT EXISTS record_revision bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.can_access_record_values(
  p_site_id uuid,
  p_relations jsonb
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sites s
    WHERE s.id = p_site_id
      AND (
        s.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.site_ownership so
          WHERE so.site_id = s.id
            AND so.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.site_members sm
          WHERE sm.site_id = s.id
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
            AND (
              NOT COALESCE(sm.restrict_to_assigned_only, false)
              OR COALESCE(p_relations, '{}'::jsonb)::text LIKE
                '%' || auth.uid()::text || '%'
            )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_record_values(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_record_values(uuid, jsonb)
  TO authenticated, service_role;

DROP POLICY IF EXISTS records_unified ON public.records;
DROP POLICY IF EXISTS records_select ON public.records;
DROP POLICY IF EXISTS records_insert ON public.records;
DROP POLICY IF EXISTS records_update ON public.records;
DROP POLICY IF EXISTS records_delete ON public.records;

CREATE POLICY records_select ON public.records
FOR SELECT TO authenticated
USING (
  public.user_can(site_id, 'select')
  AND public.can_access_record_values(site_id, relations)
);

CREATE POLICY records_insert ON public.records
FOR INSERT TO authenticated
WITH CHECK (
  public.user_can(site_id, 'insert')
  AND public.can_access_record_values(site_id, relations)
);

CREATE POLICY records_update ON public.records
FOR UPDATE TO authenticated
USING (
  public.user_can(site_id, 'update')
  AND public.can_access_record_values(site_id, relations)
)
WITH CHECK (
  public.user_can(site_id, 'update')
  AND public.can_access_record_values(site_id, relations)
);

CREATE POLICY records_delete ON public.records
FOR DELETE TO authenticated
USING (
  public.user_can(site_id, 'delete')
  AND public.can_access_record_values(site_id, relations)
);

REVOKE INSERT, UPDATE ON public.records FROM authenticated;
GRANT SELECT, DELETE ON public.records TO authenticated;
GRANT INSERT (site_id, category_id, title, description, data, relations, status)
  ON public.records TO authenticated;
GRANT UPDATE (category_id, title, description, data, relations, status)
  ON public.records TO authenticated;

DROP POLICY IF EXISTS record_categories_select ON public.record_categories;
DROP POLICY IF EXISTS record_categories_insert ON public.record_categories;
DROP POLICY IF EXISTS record_categories_update ON public.record_categories;
DROP POLICY IF EXISTS record_categories_delete ON public.record_categories;

CREATE POLICY record_categories_select ON public.record_categories
FOR SELECT TO authenticated
USING (public.user_can(site_id, 'select'));

CREATE POLICY record_categories_insert ON public.record_categories
FOR INSERT TO authenticated
WITH CHECK (public.user_can(site_id, 'insert'));

CREATE POLICY record_categories_update ON public.record_categories
FOR UPDATE TO authenticated
USING (public.user_can(site_id, 'update'))
WITH CHECK (public.user_can(site_id, 'update'));

CREATE POLICY record_categories_delete ON public.record_categories
FOR DELETE TO authenticated
USING (public.user_can(site_id, 'delete'));

REVOKE INSERT, UPDATE ON public.record_categories FROM authenticated;
GRANT SELECT, DELETE ON public.record_categories TO authenticated;
GRANT INSERT (
  site_id, name, description, icon, parent_category_id, template_fields
) ON public.record_categories TO authenticated;
GRANT UPDATE (
  name, description, icon, parent_category_id, template_fields
) ON public.record_categories TO authenticated;

ALTER TABLE public.record_embedding_jobs
  DROP CONSTRAINT IF EXISTS record_embedding_jobs_revision_uidx;
ALTER TABLE public.record_embedding_jobs
  ADD CONSTRAINT record_embedding_jobs_revision_uidx
  UNIQUE (record_id, diagram_revision, record_revision);

-- The composite FK fully replaces the legacy category-only FK. Keeping both
-- makes PostgREST embeds ambiguous (`records` -> `record_categories`).
ALTER TABLE public.records
  DROP CONSTRAINT IF EXISTS records_category_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'records_id_site_uidx'
      AND conrelid = 'public.records'::regclass
  ) THEN
    ALTER TABLE public.records
      ADD CONSTRAINT records_id_site_uidx UNIQUE (id, site_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'record_categories_id_site_uidx'
      AND conrelid = 'public.record_categories'::regclass
  ) THEN
    ALTER TABLE public.record_categories
      ADD CONSTRAINT record_categories_id_site_uidx UNIQUE (id, site_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'records_category_site_fkey'
      AND conrelid = 'public.records'::regclass
  ) THEN
    ALTER TABLE public.records
      ADD CONSTRAINT records_category_site_fkey
      FOREIGN KEY (category_id, site_id)
      REFERENCES public.record_categories(id, site_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'record_categories_parent_site_fkey'
      AND conrelid = 'public.record_categories'::regclass
  ) THEN
    ALTER TABLE public.record_categories
      ADD CONSTRAINT record_categories_parent_site_fkey
      FOREIGN KEY (parent_category_id, site_id)
      REFERENCES public.record_categories(id, site_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'record_diagrams_record_site_parent_fkey'
      AND conrelid = 'public.record_diagrams'::regclass
  ) THEN
    ALTER TABLE public.record_diagrams
      ADD CONSTRAINT record_diagrams_record_site_parent_fkey
      FOREIGN KEY (record_id, site_id)
      REFERENCES public.records(id, site_id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'record_embedding_jobs_record_site_fkey'
      AND conrelid = 'public.record_embedding_jobs'::regclass
  ) THEN
    ALTER TABLE public.record_embedding_jobs
      ADD CONSTRAINT record_embedding_jobs_record_site_fkey
      FOREIGN KEY (record_id, site_id)
      REFERENCES public.records(id, site_id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
