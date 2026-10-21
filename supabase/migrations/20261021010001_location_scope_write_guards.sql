BEGIN;
SET LOCAL lock_timeout = '5s';

-- A transaction-bound capability, not a caller-settable GUC. Only the manager
-- RPC and the table trigger can access it; no browser/service DML grants exist.
CREATE TABLE location_acl_private.scope_assignments (
  transaction_id bigint NOT NULL,
  table_name text NOT NULL,
  row_id uuid NOT NULL,
  site_id uuid NOT NULL,
  location_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  PRIMARY KEY(transaction_id,table_name,row_id)
);
REVOKE ALL ON location_acl_private.scope_assignments FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.location_acl_guard_root_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE scope_column text; old_data jsonb := to_jsonb(OLD); data jsonb := to_jsonb(NEW);
  approved boolean := false; link record; child_scope text; inconsistent boolean;
BEGIN
  SELECT location_column INTO STRICT scope_column FROM location_acl_private.roots WHERE table_name=TG_TABLE_NAME;
  IF old_data->'site_id' IS DISTINCT FROM data->'site_id'
    OR old_data->'id' IS DISTINCT FROM data->'id' THEN
    RAISE EXCEPTION 'Operational root identity is immutable' USING ERRCODE='23514';
  END IF;
  IF old_data->scope_column IS NOT DISTINCT FROM data->scope_column THEN RETURN NEW; END IF;
  IF old_data->>scope_column IS NOT NULL OR data->>scope_column IS NULL THEN
    RAISE EXCEPTION 'Known location scope is immutable' USING ERRCODE='23514';
  END IF;
  DELETE FROM location_acl_private.scope_assignments
    WHERE transaction_id=txid_current() AND table_name=TG_TABLE_NAME
      AND row_id=NEW.id AND site_id=NEW.site_id
      AND location_id=(data->>scope_column)::uuid AND actor_id=auth.uid()
    RETURNING true INTO approved;
  IF approved IS DISTINCT FROM true
    OR coalesce(public.current_user_site_role(NEW.site_id),'') NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Manager scope assignment required' USING ERRCODE='42501';
  END IF;
  -- Child validation locks the parent FOR SHARE. Initial assignment must not
  -- invalidate an existing child's scope, including unresolved NULL children.
  FOR link IN SELECT * FROM location_acl_private.links WHERE parent_table=TG_TABLE_NAME AND same_location LOOP
    SELECT location_column INTO STRICT child_scope FROM location_acl_private.roots WHERE table_name=link.child_table;
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE %I=$1
      AND (%I IS DISTINCT FROM $2 OR site_id IS DISTINCT FROM $3))',
      link.child_table,link.child_column,child_scope)
      INTO inconsistent USING NEW.id,(data->>scope_column)::uuid,NEW.site_id;
    IF inconsistent THEN
      RAISE EXCEPTION 'Operational parent scope is inconsistent' USING ERRCODE='23514';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.location_acl_guard_root_scope() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.assign_location_scope(p_table text,p_id uuid,p_site_id uuid,p_location_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE scope_column text; changed integer;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Scope assignment requires READ COMMITTED' USING ERRCODE='40001';
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  PERFORM public.lock_site_license(p_site_id);
  IF coalesce(public.current_user_site_role(p_site_id),'') NOT IN ('owner','admin')
    OR p_location_id IS NULL OR NOT public.user_can_access_location(p_site_id,p_location_id) THEN
    RAISE EXCEPTION 'Manager location access required' USING ERRCODE='42501';
  END IF;
  SELECT location_column INTO scope_column FROM location_acl_private.roots
    WHERE table_name=p_table AND table_name IN ('deals','quotations','subscriptions','tasks',
      'conversations','records','sale_orders','reservations');
  IF scope_column IS NULL THEN RAISE EXCEPTION 'Unsupported scope root' USING ERRCODE='22023'; END IF;
  INSERT INTO location_acl_private.scope_assignments VALUES
    (txid_current(),p_table,p_id,p_site_id,p_location_id,auth.uid());
  EXECUTE format('UPDATE public.%I SET %I=$1 WHERE id=$2 AND site_id=$3 AND %I IS NULL',
    p_table,scope_column,scope_column) USING p_location_id,p_id,p_site_id;
  GET DIAGNOSTICS changed=ROW_COUNT;
  DELETE FROM location_acl_private.scope_assignments
    WHERE transaction_id=txid_current() AND table_name=p_table AND row_id=p_id;
  IF changed<>1 THEN RAISE EXCEPTION 'Unresolved root not found' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('table',p_table,'id',p_id,'site_id',p_site_id,'location_id',p_location_id);
END;
$$;

-- Validate visibility as the actual invoker before definer inheritance reads
-- parent scope. A hidden row and a nonexistent ID produce the same denial.
DO $$
DECLARE t record; link record; body text; changed text; scope_column text;
BEGIN
  FOR t IN SELECT * FROM location_acl_private.roots LOOP
    EXECUTE format('CREATE TRIGGER location_acl_20_immutable BEFORE UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.location_acl_guard_root_scope()',t.table_name);
  END LOOP;
  FOR t IN SELECT DISTINCT child_table FROM location_acl_private.links LOOP
    SELECT location_column INTO scope_column FROM location_acl_private.roots WHERE table_name=t.child_table;
    body := 'BEGIN IF current_setting(''role'',true) <> ''authenticated'' THEN RETURN NEW; END IF;';
    FOR link IN SELECT * FROM location_acl_private.links WHERE child_table=t.child_table ORDER BY child_column LOOP
      changed := format('TG_OP=''INSERT'' OR to_jsonb(OLD)->%L IS DISTINCT FROM to_jsonb(NEW)->%L
        OR to_jsonb(OLD)->''site_id'' IS DISTINCT FROM to_jsonb(NEW)->''site_id''',link.child_column,link.child_column);
      IF scope_column IS NOT NULL THEN
        changed := changed || format(' OR to_jsonb(OLD)->%L IS DISTINCT FROM to_jsonb(NEW)->%L',scope_column,scope_column);
      END IF;
      body := body || format(' IF (%s) AND NEW.%I IS NOT NULL AND NOT EXISTS
        (SELECT 1 FROM public.%I WHERE id=NEW.%I) THEN
        RAISE EXCEPTION ''Operational parent unavailable'' USING ERRCODE=''42501''; END IF;',
        changed,link.child_column,link.parent_table,link.child_column);
    END LOOP;
    body := body || ' RETURN NEW; END';
    EXECUTE format('CREATE FUNCTION public.%I() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
      SET search_path=public,pg_temp AS %L','location_acl_visible_'||t.child_table,body);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I() FROM PUBLIC,anon,authenticated,service_role',
      'location_acl_visible_'||t.child_table);
    EXECUTE format('CREATE TRIGGER location_acl_10_visible BEFORE INSERT OR UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.%I()',t.child_table,'location_acl_visible_'||t.child_table);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.location_acl_inherit_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE link record; data jsonb := to_jsonb(NEW); old_data jsonb;
  scope_column text; scope_id uuid; parent_site uuid; parent_scope uuid; parent_column text;
  inherited_scope uuid; has_parent boolean := false; links_changed boolean;
BEGIN
  SELECT location_column INTO scope_column FROM location_acl_private.roots WHERE table_name=TG_TABLE_NAME;
  IF TG_OP='UPDATE' THEN
    old_data := to_jsonb(OLD);
    SELECT EXISTS(SELECT 1 FROM location_acl_private.links l WHERE l.child_table=TG_TABLE_NAME
      AND old_data->l.child_column IS DISTINCT FROM data->l.child_column) INTO links_changed;
    IF old_data->scope_column IS NOT DISTINCT FROM data->scope_column
      AND old_data->'site_id' IS NOT DISTINCT FROM data->'site_id' AND NOT links_changed THEN RETURN NEW; END IF;
  END IF;
  scope_id := (data->>scope_column)::uuid;
  FOR link IN SELECT * FROM location_acl_private.links WHERE child_table=TG_TABLE_NAME ORDER BY parent_table,child_column LOOP
    IF data->>link.child_column IS NULL THEN
      IF link.required THEN RAISE EXCEPTION 'Operational parent required' USING ERRCODE='23503'; END IF;
      CONTINUE;
    END IF;
    SELECT location_column INTO parent_column FROM location_acl_private.roots WHERE table_name=link.parent_table;
    -- SHARE conflicts with non-key scope updates after redundant triple FKs go.
    EXECUTE format('SELECT site_id,%s FROM public.%I WHERE id=$1 FOR SHARE',
      CASE WHEN parent_column IS NULL THEN 'NULL::uuid' ELSE quote_ident(parent_column) END,link.parent_table)
      INTO parent_site,parent_scope USING (data->>link.child_column)::uuid;
    IF parent_site IS NULL OR (data ? 'site_id' AND parent_site IS DISTINCT FROM (data->>'site_id')::uuid) THEN
      RAISE EXCEPTION 'Operational parent unavailable' USING ERRCODE='23503';
    END IF;
    IF NOT link.same_location THEN CONTINUE; END IF;
    IF has_parent AND parent_scope IS DISTINCT FROM inherited_scope THEN
      RAISE EXCEPTION 'All operational parent locations must agree' USING ERRCODE='23514';
    END IF;
    inherited_scope := parent_scope; has_parent := true;
    IF scope_id IS NULL AND TG_OP='INSERT' THEN scope_id := parent_scope; END IF;
    IF scope_id IS DISTINCT FROM parent_scope THEN
      RAISE EXCEPTION 'All operational parent locations must agree' USING ERRCODE='23514';
    END IF;
  END LOOP;
  IF scope_column IS NOT NULL THEN NEW := jsonb_populate_record(NEW,jsonb_build_object(scope_column,scope_id)); END IF;
  RETURN NEW;
END;
$$;
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT DISTINCT child_table FROM location_acl_private.links LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS location_acl_inherit ON public.%I',t);
    EXECUTE format('CREATE TRIGGER location_acl_inherit BEFORE INSERT OR UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.location_acl_inherit_scope()',t);
  END LOOP;
END;
$$;
COMMIT;