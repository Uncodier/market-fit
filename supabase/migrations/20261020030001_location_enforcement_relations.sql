BEGIN;
SET LOCAL lock_timeout = '5s';

-- All populated links are conjunctive, never first-parent-wins. Lead rows are
-- intentionally opaque until a separately reviewed minimal identity projection.
INSERT INTO location_acl_private.links(child_table,child_column,parent_table,required,same_location) VALUES
  ('quotations','deal_id','deals',false,true),
  ('sales','quotation_id','quotations',false,true),
  ('sales','subscription_id','subscriptions',false,true),
  ('tasks','conversation_id','conversations',false,true),
  ('tasks','deal_id','deals',false,true),
  ('tasks','lead_id','leads',false,false),
  ('sale_orders','sale_id','sales',false,true),
  ('sale_orders','quotation_id','quotations',false,true),
  ('transactions','sale_order_id','sale_orders',false,true),
  ('reservations','sale_order_item_id','sale_order_items',false,false),
  ('sale_order_items','sale_order_id','sale_orders',true,false),
  ('sale_order_items','shipment_id','shipments',false,false),
  ('sale_order_item_units','sale_order_item_id','sale_order_items',true,false),
  ('sale_order_item_units','shipment_id','shipments',false,false),
  ('quotation_items','quotation_id','quotations',true,false),
  ('purchase_items','purchase_id','purchases',true,false),
  ('messages','conversation_id','conversations',true,false),
  ('task_comments','task_id','tasks',true,false),
  ('task_categories','task_id','tasks',true,false),
  ('deal_owners','deal_id','deals',true,false),
  ('invoice_reminders','sale_id','sales',true,false),
  ('accounting_sale_refunds','sale_id','sales',true,false),
  ('shipments','sale_order_id','sale_orders',true,false),
  ('shipments','sale_id','sales',false,false),
  ('shipment_location_pings','shipment_id','shipments',true,false),
  ('pos_register_movements','session_id','pos_register_sessions',true,false),
  ('pos_register_receipts','session_id','pos_register_sessions',true,false),
  ('pos_register_receipts','sale_id','sales',true,false);

-- Columns are catalog-checked: links not present in this deployment cannot be
-- inferred from metadata. Additional unknown projections remain centrally denied.
DELETE FROM location_acl_private.links l WHERE NOT EXISTS (
  SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname=l.child_table
    AND a.attname=l.child_column AND a.attnum>0 AND NOT a.attisdropped
);

DO $$
DECLARE r record; child_scope text; parent_scope text; delete_action text;
BEGIN
  FOR r IN SELECT DISTINCT parent_table FROM location_acl_private.links LOOP
    EXECUTE format('CREATE UNIQUE INDEX location_acl_%I_parent_key ON public.%I(site_id,id)',
      r.parent_table,r.parent_table);
  END LOOP;
  FOR r IN SELECT * FROM location_acl_private.links LOOP
    SELECT CASE c.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
      WHEN 'd' THEN 'SET DEFAULT' WHEN 'r' THEN 'RESTRICT' ELSE 'NO ACTION' END
      INTO delete_action FROM pg_constraint c JOIN pg_attribute a
        ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
      WHERE c.contype='f' AND c.conrelid=to_regclass('public.'||r.child_table)
        AND c.confrelid=to_regclass('public.'||r.parent_table) AND a.attname=r.child_column
      ORDER BY cardinality(c.conkey) LIMIT 1;
    -- Preserve existing cascades; SET NULL must affect only the relationship,
    -- never clear a child's tenant or canonical commercial location.
    delete_action := coalesce(delete_action,'NO ACTION');
    IF delete_action='SET NULL' THEN delete_action := format('SET NULL (%I)',r.child_column); END IF;
    IF delete_action='SET DEFAULT' THEN delete_action := format('SET DEFAULT (%I)',r.child_column); END IF;
    -- Some legacy child tables have no tenant column. Parent RLS remains the
    -- authority for them; no redundant user-writable tenant column is introduced.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name=r.child_table AND column_name='site_id') THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I
        CHECK (%I IS NULL OR site_id IS NOT NULL) NOT VALID',
        r.child_table,'location_acl_'||r.child_column||'_requires_site',r.child_column);
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I
        FOREIGN KEY(site_id,%I) REFERENCES public.%I(site_id,id) ON DELETE %s NOT VALID',
        r.child_table,'location_acl_'||r.child_column||'_site_fk',r.child_column,r.parent_table,delete_action);
    END IF;
    EXECUTE format('CREATE INDEX %I ON public.%I(%I)',
      'location_acl_'||r.child_table||'_'||r.child_column,r.child_table,r.child_column);
    IF r.same_location THEN
      SELECT location_column INTO child_scope FROM location_acl_private.roots WHERE table_name=r.child_table;
      SELECT location_column INTO parent_scope FROM location_acl_private.roots WHERE table_name=r.parent_table;
      EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I(site_id,id,%I)',
        'location_acl_'||r.parent_table||'_scope_key',r.parent_table,parent_scope);
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I
        FOREIGN KEY(site_id,%I,%I) REFERENCES public.%I(site_id,id,%I) ON DELETE %s NOT VALID',
        r.child_table,'location_acl_'||r.child_column||'_scope_fk',r.child_column,child_scope,
        r.parent_table,parent_scope,delete_action);
    END IF;
  END LOOP;
END;
$$;

-- Inheritance is real write behavior, not merely a SELECT filter. Existing null
-- records remain unresolved. New roots copy only typed, same-site parents, and
-- disagreement among any parents rejects the entire mutation.
CREATE FUNCTION public.location_acl_inherit_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE r record; data jsonb := to_jsonb(NEW); scope_column text;
  scope_id uuid; parent_site uuid; parent_scope uuid; parent_column text;
  inherited_scope uuid; has_parent boolean := false;
  old_data jsonb; links_changed boolean := false;
BEGIN
  SELECT location_column INTO STRICT scope_column FROM location_acl_private.roots WHERE table_name=TG_TABLE_NAME;
  IF TG_OP='UPDATE' THEN
    old_data := to_jsonb(OLD);
    SELECT EXISTS(SELECT 1 FROM location_acl_private.links link
      WHERE link.child_table=TG_TABLE_NAME AND link.same_location
        AND old_data->link.child_column IS DISTINCT FROM data->link.child_column) INTO links_changed;
    IF old_data->scope_column IS NOT DISTINCT FROM data->scope_column
      AND old_data->'site_id' IS NOT DISTINCT FROM data->'site_id' AND NOT links_changed THEN RETURN NEW; END IF;
  END IF;
  scope_id := (data->>scope_column)::uuid;
  FOR r IN SELECT * FROM location_acl_private.links WHERE child_table=TG_TABLE_NAME AND same_location LOOP
    IF data->>r.child_column IS NULL THEN CONTINUE; END IF;
    SELECT location_column INTO STRICT parent_column FROM location_acl_private.roots WHERE table_name=r.parent_table;
    EXECUTE format('SELECT site_id,%I FROM public.%I WHERE id=$1 FOR KEY SHARE',parent_column,r.parent_table)
      INTO parent_site,parent_scope USING (data->>r.child_column)::uuid;
    IF parent_site IS DISTINCT FROM (data->>'site_id')::uuid THEN
      RAISE EXCEPTION 'Location parent must belong to the same site' USING ERRCODE='23503';
    END IF;
    IF has_parent AND parent_scope IS DISTINCT FROM inherited_scope THEN
      RAISE EXCEPTION 'All operational parent locations must agree' USING ERRCODE='23514';
    END IF;
    inherited_scope := parent_scope; has_parent := true;
    IF scope_id IS NULL AND TG_OP='INSERT' THEN scope_id := parent_scope; END IF;
    IF scope_id IS DISTINCT FROM parent_scope THEN
      RAISE EXCEPTION 'All operational parent locations must agree' USING ERRCODE='23514';
    END IF;
  END LOOP;
  NEW := jsonb_populate_record(NEW,jsonb_build_object(scope_column,scope_id));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.location_acl_inherit_scope() FROM PUBLIC,anon,authenticated,service_role;
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT DISTINCT child_table FROM location_acl_private.links WHERE same_location LOOP
    EXECUTE format('CREATE TRIGGER location_acl_inherit BEFORE INSERT OR UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.location_acl_inherit_scope()',t);
  END LOOP;
END;
$$;
COMMIT;