BEGIN;
SET LOCAL lock_timeout = '5s';

-- These are supplemental AND policies, never grants or replacements for action,
-- assignment, membership, buyer ownership, or existing public-token policies.
-- A child EXISTS runs as the querying role, preserving its parent's own RLS.
DO $$
DECLARE t record; r record; root_column text; predicate text; link_check text;
  has_site boolean; child_scope text; parent_scope text; child_location text;
  operational boolean; command text; action_scope text; action_check text;
  exempt_tables text[] := ARRAY[
    'sites','site_members','site_ownership','site_member_location_restrictions',
    'site_member_location_restriction_audit','location_access_rollout',
    'profiles','users','user_preferences','countries','currencies',
    'catalog_items','catalog_categories','catalog_item_categories',
    'price_lists','price_list_items','promotions','promotion_items'
  ];
BEGIN
  FOR t IN SELECT c.oid,c.relname,c.relowner,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND NOT c.relname=ANY(exempt_tables) ORDER BY c.relname LOOP
    -- The migration coordinator owns this private infrastructure table. Do not
    -- take ownership or silently skip other foreign-owned/application tables.
    IF t.relname='apps_migration_feedback' THEN
      IF pg_get_userbyid(t.relowner)<>'apps_migration_coordinator' OR NOT t.relrowsecurity
        OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated']) actor
          WHERE has_table_privilege(actor,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            OR has_any_column_privilege(actor,t.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
        OR EXISTS(SELECT 1 FROM location_acl_private.roots WHERE table_name=t.relname)
        OR EXISTS(SELECT 1 FROM location_acl_private.links
          WHERE child_table=t.relname OR parent_table=t.relname) THEN
        RAISE EXCEPTION 'Review private infrastructure boundary for public.apps_migration_feedback'
          USING ERRCODE='42501';
      END IF;
      CONTINUE;
    END IF;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name=t.relname AND column_name='site_id') INTO has_site;
    SELECT location_column INTO root_column FROM location_acl_private.roots WHERE table_name=t.relname;
    predicate := NULL;
    IF root_column IS NOT NULL THEN
      predicate := format('public.user_can_access_location(%I.site_id,%I.%I)',t.relname,t.relname,root_column);
    ELSIF EXISTS(SELECT 1 FROM location_acl_private.links WHERE child_table=t.relname AND required) THEN
      predicate := 'true';
    END IF;
    operational := predicate IS NOT NULL;
    IF predicate IS NOT NULL THEN
      FOR r IN SELECT * FROM location_acl_private.links WHERE child_table=t.relname ORDER BY child_column LOOP
        link_check := format('EXISTS (SELECT 1 FROM public.%I acl_parent WHERE acl_parent.id=%I.%I',
          r.parent_table,t.relname,r.child_column);
        IF has_site THEN link_check := link_check || format(' AND acl_parent.site_id=%I.site_id',t.relname); END IF;
        IF r.same_location THEN
          SELECT location_column INTO child_scope FROM location_acl_private.roots WHERE table_name=t.relname;
          SELECT location_column INTO parent_scope FROM location_acl_private.roots WHERE table_name=r.parent_table;
          link_check := link_check || format(' AND acl_parent.%I IS NOT DISTINCT FROM %I.%I',
            parent_scope,t.relname,child_scope);
        END IF;
        link_check := link_check || ')';
        IF NOT r.required THEN link_check := format('(%I.%I IS NULL OR %s)',t.relname,r.child_column,link_check); END IF;
        predicate := predicate || ' AND ' || link_check;
      END LOOP;
      -- Fulfillment location is additional narrowing only, never parent authority.
      SELECT column_name INTO child_location FROM information_schema.columns
        WHERE table_schema='public' AND table_name=t.relname AND column_name='location_id';
      IF root_column IS NULL AND child_location IS NOT NULL AND has_site THEN
        predicate := predicate || format(' AND (%I.location_id IS NULL OR public.user_can_access_location(%I.site_id,%I.location_id))',
          t.relname,t.relname,t.relname);
      END IF;
      IF t.relname='inventory_levels' THEN
        predicate := predicate || ' AND EXISTS (SELECT 1 FROM public.catalog_items acl_item
          WHERE acl_item.id=inventory_levels.catalog_item_id AND acl_item.site_id=inventory_levels.site_id)';
      END IF;
      IF t.relname='records' AND EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='records' AND column_name='relations') THEN
        predicate := predicate || ' AND (records.relations IS NULL OR records.relations::jsonb IN (''[]''::jsonb,''{}''::jsonb))
          AND records.source_id IS NULL';
      END IF;
      IF t.relname='sale_order_items' AND EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='sale_order_items' AND column_name='parent_sale_order_item_id') THEN
        predicate := predicate || ' AND sale_order_items.parent_sale_order_item_id IS NULL';
      END IF;
      IF has_site THEN
        predicate := format('(public.current_user_site_role(%I.site_id) IN (''owner'',''admin'') OR (%s))',t.relname,predicate);
      END IF;
    ELSE
      -- Private global notes, reports, journal projections, search/vector results,
      -- automations and unknown children do not become shared by omission.
      predicate := 'false';
    END IF;
    predicate := '(NOT (SELECT public.current_user_has_location_restrictions()) OR ('||predicate||'))';
    IF NOT t.relrowsecurity THEN
      -- Preserve existing table grants and anonymous contracts when installing
      -- RLS on a previously unprotected legacy table; add no privilege grants.
      EXECUTE format('CREATE POLICY location_acl_legacy_grants ON public.%I USING(true) WITH CHECK(true)',t.relname);
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.relname);
    EXECUTE format('CREATE POLICY location_acl_enforcement ON public.%I AS RESTRICTIVE
      FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',t.relname,predicate,predicate);
    IF operational THEN
      FOREACH command IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
        IF has_site THEN
          action_scope := format('public.user_can(%I.site_id,%L)',t.relname,lower(command));
        ELSE
          SELECT * INTO STRICT r FROM location_acl_private.links
            WHERE child_table=t.relname AND required ORDER BY child_column LIMIT 1;
          action_scope := format('EXISTS (SELECT 1 FROM public.%I acl_action_parent
            WHERE acl_action_parent.id=%I.%I AND public.user_can(acl_action_parent.site_id,%L))',
            r.parent_table,t.relname,r.child_column,lower(command));
        END IF;
        action_check := '(NOT (SELECT public.current_user_has_location_restrictions()) OR ('||action_scope||'))';
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s',
          'location_acl_action_'||lower(command),t.relname,command,
          CASE command WHEN 'INSERT' THEN format('WITH CHECK (%s)',action_check)
            WHEN 'UPDATE' THEN format('USING (%s) WITH CHECK (%s)',action_check,action_check)
            ELSE format('USING (%s)',action_check) END);
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- Global catalog rows may be read under their existing public contract, not
-- mutated globally by a branch-restricted actor. No catalog SELECT grant added.
DO $$
DECLARE t text; command text;
BEGIN
  FOREACH t IN ARRAY ARRAY['locations','catalog_items','catalog_categories','catalog_item_categories',
    'price_lists','price_list_items','promotions','promotion_items'] LOOP
    IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;
    FOREACH command IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
      EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s',
        'location_acl_central_'||lower(command),t,command,
        CASE command WHEN 'INSERT' THEN 'WITH CHECK (NOT (SELECT public.current_user_has_location_restrictions()))'
          WHEN 'DELETE' THEN 'USING (NOT (SELECT public.current_user_has_location_restrictions()))'
          ELSE 'USING (NOT (SELECT public.current_user_has_location_restrictions()))
            WITH CHECK (NOT (SELECT public.current_user_has_location_restrictions()))' END);
    END LOOP;
  END LOOP;
END;
$$;

-- Existing owner-view semantics/grants remain for unrestricted and anon callers.
-- Restricted actors cannot use an opaque owner projection to bypass base RLS.
-- Preserve public names/OIDs/dependencies and owner; snapshots require review.
DO $$
DECLARE r record; definition text;
BEGIN
  FOR r IN SELECT c.oid,c.relname,c.relkind,c.reloptions FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('v','m') LOOP
    IF r.relkind='v' THEN
      IF coalesce(r.reloptions,'{}'::text[]) @> ARRAY['security_invoker=true'] THEN CONTINUE; END IF;
      IF EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class=r.oid AND rulename<>'_RETURN') THEN
        RAISE EXCEPTION 'Review rule-based projection % before activating location ACL',r.relname;
      END IF;
      definition := regexp_replace(pg_get_viewdef(r.oid,true), ';\s*$', '');
      EXECUTE format('CREATE OR REPLACE VIEW public.%I AS SELECT * FROM (%s) acl_projection
        WHERE current_setting(''role'',true) <> ''authenticated''
          OR NOT public.current_user_has_location_restrictions()',r.relname,definition);
      -- Read-only aggregate views cannot use CHECK OPTION. Existing table grants
      -- and root policies still protect writes; simple updatable views need it.
      IF pg_relation_is_updatable(r.oid,false) <> 0 THEN
        EXECUTE format('ALTER VIEW public.%I SET (check_option=cascaded)',r.relname);
      END IF;
    ELSIF has_table_privilege('authenticated',format('public.%I',r.relname),'SELECT') THEN
      RAISE EXCEPTION 'Review authenticated materialized projection % before activating location ACL',r.relname;
    END IF;
  END LOOP;
END;
$$;

-- Existing public URLs cannot be revoked by RLS. Authenticated storage API
-- enumeration/signing/mutations are an opaque private projection until typed
-- attachment-parent authorization is implemented. Anon/service remain intact.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    CREATE POLICY location_acl_private_storage ON storage.objects AS RESTRICTIVE
      FOR ALL TO authenticated USING(NOT (SELECT public.current_user_has_location_restrictions()))
      WITH CHECK(NOT (SELECT public.current_user_has_location_restrictions()));
  END IF;
END;
$$;
COMMIT;
