BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.location_acl_assert_unscoped_rpc()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
BEGIN
  -- SECURITY DEFINER changes current_user, not the authenticated session role.
  -- Independent anon/service contracts are intentionally outside this boundary.
  IF current_setting('role',true) = 'authenticated'
    AND public.current_user_has_location_restrictions() THEN
    RAISE EXCEPTION 'This operation has no authorized location projection' USING ERRCODE='42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.location_acl_assert_unscoped_rpc() FROM PUBLIC,anon,authenticated,service_role;

-- Keep public function OIDs/signatures/defaults and all original grants: policies,
-- views, triggers and existing callers therefore still reach the guarded entry.
-- Bodies move to a non-exposed, no-USAGE schema; direct calls cannot bypass it.
-- An exhaustive default deny covers old RPCs not known to this repository.
DO $$
DECLARE f record; definition text; private_name text; call_args text; out_args text;
  body text; header text;
  safe_signatures text[] := ARRAY[
    'public.current_user_site_role(uuid)','public.user_can(uuid,text)',
    'public.site_member_has_effective_license(uuid)','public.effective_site_plan(uuid)',
    'public.lock_site_license(uuid)','public.current_user_location_access(uuid)',
    'public.user_can_access_location(uuid,uuid)','public.current_user_has_location_restrictions()',
    'public.current_user_has_site_location_restrictions(uuid)',
    'public.read_site_location_restrictions(uuid)',
    'public.replace_site_member_location_restrictions(uuid,uuid,uuid[])',
    'public.get_my_site_capabilities(uuid)','public.is_deal_owner(uuid,uuid)',
    'public.can_access_record_values(uuid,jsonb)'
  ];
BEGIN
  FOR f IN SELECT p.*,pg_get_function_arguments(p.oid) arguments,
    pg_get_function_identity_arguments(p.oid) identity_arguments,
    pg_get_function_result(p.oid) result_type
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f' AND p.prosecdef
      AND p.prorettype <> 'trigger'::regtype AND p.prorettype <> 'event_trigger'::regtype
      AND has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND NOT EXISTS(SELECT 1 FROM unnest(safe_signatures) signature
        WHERE to_regprocedure(signature)=p.oid) ORDER BY p.oid LOOP
    IF f.provariadic <> 0 THEN
      RAISE EXCEPTION 'Review variadic privileged RPC % before activation',f.proname;
    END IF;
    private_name := 'original_'||f.oid;
    IF pg_get_userbyid(f.proowner) IN ('anon','authenticated','service_role') THEN
      RAISE EXCEPTION 'Privileged RPC % has an unsafe owner',f.proname;
    END IF;
    EXECUTE format('GRANT USAGE ON SCHEMA location_acl_private TO %I',pg_get_userbyid(f.proowner));
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.location_acl_assert_unscoped_rpc() TO %I',pg_get_userbyid(f.proowner));
    definition := pg_get_functiondef(f.oid);
    definition := replace(definition,
      format('CREATE OR REPLACE FUNCTION public.%I(',f.proname),
      format('CREATE OR REPLACE FUNCTION location_acl_private.%I(',private_name));
    EXECUTE definition;
    EXECUTE format('REVOKE ALL ON FUNCTION location_acl_private.%I(%s)
      FROM PUBLIC,anon,authenticated,service_role',private_name,f.identity_arguments);
    SELECT string_agg('$'||i,',' ORDER BY i) INTO call_args FROM generate_series(1,f.pronargs) i;
    call_args := coalesce(call_args,'');
    body := 'BEGIN PERFORM public.location_acl_assert_unscoped_rpc(); ';
    IF f.proretset THEN
      body := body || format('RETURN QUERY SELECT * FROM location_acl_private.%I(%s);',private_name,call_args);
    ELSIF f.prorettype='void'::regtype THEN
      body := body || format('PERFORM location_acl_private.%I(%s); RETURN;',private_name,call_args);
    ELSIF f.proargmodes IS NOT NULL AND EXISTS (
      SELECT 1 FROM unnest(f.proargmodes) mode WHERE mode IN ('o','b')) THEN
      SELECT string_agg(quote_ident(f.proargnames[i]),',' ORDER BY i) INTO out_args
        FROM generate_subscripts(f.proargmodes,1) i WHERE f.proargmodes[i] IN ('o','b');
      IF out_args IS NULL THEN RAISE EXCEPTION 'Unnamed output on privileged RPC %',f.proname; END IF;
      body := body || format('SELECT * INTO %s FROM location_acl_private.%I(%s); RETURN;',out_args,private_name,call_args);
    ELSE
      body := body || format('RETURN location_acl_private.%I(%s);',private_name,call_args);
    END IF;
    body := body || ' END';
    header := format('CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS %s
      LANGUAGE plpgsql SECURITY DEFINER %s %s PARALLEL UNSAFE SET search_path=public,pg_temp AS %L',
      f.proname,f.arguments,f.result_type,
      CASE WHEN f.provolatile='v' THEN 'VOLATILE' ELSE 'STABLE' END,
      CASE WHEN f.proisstrict THEN 'STRICT' ELSE 'CALLED ON NULL INPUT' END,body);
    EXECUTE header;
    -- Preserve function-owner semantics for the copied body and public wrapper.
    EXECUTE format('ALTER FUNCTION location_acl_private.%I(%s) OWNER TO %I',
      private_name,f.identity_arguments,pg_get_userbyid(f.proowner));
  END LOOP;
END;
$$;
COMMIT;