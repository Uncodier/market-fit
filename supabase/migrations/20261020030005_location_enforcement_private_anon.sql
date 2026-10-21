BEGIN;
SET LOCAL lock_timeout = '5s';

-- Separate from actor ACL: a private workspace is not a public contract merely
-- because a historical policy allowed auth.uid() IS NULL. Otherwise logout is
-- a universal location bypass. Public catalog remains under existing policies;
-- guest/buyer/token DTOs use independently authorized server/service contracts.
DO $$
DECLARE r record; definition text;
BEGIN
  FOR r IN SELECT c.oid,c.relname,c.relowner,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname <> ALL(ARRAY[
        'sites','countries','currencies','catalog_items','catalog_categories',
        'catalog_item_categories','price_lists','price_list_items','promotions','promotion_items'
      ]) LOOP
    -- Repeat the preflight: grants/ownership may have drifted since step 3.
    -- PUBLIC and inherited privileges are included in these role checks.
    IF r.relname='apps_migration_feedback' THEN
      IF pg_get_userbyid(r.relowner)<>'apps_migration_coordinator' OR NOT r.relrowsecurity
        OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated']) actor
          WHERE has_table_privilege(actor,r.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            OR has_any_column_privilege(actor,r.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
        OR EXISTS(SELECT 1 FROM location_acl_private.roots WHERE table_name=r.relname)
        OR EXISTS(SELECT 1 FROM location_acl_private.links
          WHERE child_table=r.relname OR parent_table=r.relname) THEN
        RAISE EXCEPTION 'Review private infrastructure boundary for public.apps_migration_feedback'
          USING ERRCODE='42501';
      END IF;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',r.relname);
    EXECUTE format('CREATE POLICY location_acl_private_anon ON public.%I AS RESTRICTIVE
      FOR ALL TO anon USING(false) WITH CHECK(false)',r.relname);
  END LOOP;
  FOR r IN SELECT c.oid,c.relname,c.reloptions FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='v' LOOP
    IF coalesce(r.reloptions,'{}'::text[]) @> ARRAY['security_invoker=true'] THEN CONTINUE; END IF;
    definition := regexp_replace(pg_get_viewdef(r.oid,true), ';\s*$', '');
    EXECUTE format('CREATE OR REPLACE VIEW public.%I AS SELECT * FROM (%s) acl_private_projection
      WHERE current_setting(''role'',true) <> ''anon''',r.relname,definition);
    IF pg_relation_is_updatable(r.oid,false)<>0 THEN
      EXECUTE format('ALTER VIEW public.%I SET (check_option=cascaded)',r.relname);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.location_acl_assert_unscoped_rpc()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
BEGIN
  IF current_setting('role',true) = 'anon' OR (
    current_setting('role',true) = 'authenticated'
    AND public.current_user_has_location_restrictions()
  ) THEN
    RAISE EXCEPTION 'This operation has no authorized location projection' USING ERRCODE='42501';
  END IF;
END;
$$;

-- Authentication-only predicates may be callable by anon but reveal no row
-- content. Every other anon SECURITY DEFINER not wrapped in the preceding
-- migration is revoked (including PUBLIC inheritance); service grants survive.
DO $$
DECLARE f record;
  safe_signatures text[] := ARRAY[
    'public.current_user_site_role(uuid)','public.user_can(uuid,text)',
    'public.current_user_has_location_restrictions()',
    'public.get_my_site_capabilities(uuid)'
  ];
BEGIN
  FOR f IN SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f' AND p.prosecdef
      AND has_function_privilege('anon',p.oid,'EXECUTE')
      AND NOT EXISTS(SELECT 1 FROM unnest(safe_signatures) signature WHERE to_regprocedure(signature)=p.oid)
  LOOP
    -- Restore explicit grants inherited from PUBLIC before removing PUBLIC so
    -- unrelated authenticated/service callers keep their previous privilege.
    IF has_function_privilege('authenticated',f.oid,'EXECUTE') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',f.proname,f.args);
    END IF;
    IF has_function_privilege('service_role',f.oid,'EXECUTE') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',f.proname,f.args);
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC,anon',f.proname,f.args);
  END LOOP;
END;
$$;
COMMIT;
