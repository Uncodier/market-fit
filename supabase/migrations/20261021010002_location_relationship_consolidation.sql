BEGIN;
SET LOCAL lock_timeout = '5s';

-- PostgREST discovers every public FK, including NOT VALID constraints. One
-- canonical relationship per legacy column keeps both plain and !constraint
-- embeds working. Distinct reservation resource/operating locations stay distinct.
DO $$
DECLARE link record; legacy record; old_count integer; old_oid oid; delete_action text; update_action text;
BEGIN
  FOR link IN
    SELECT table_name child_table,location_column child_column,'locations'::text parent_table,
      'location_acl_location_site_fk'::text constraint_name FROM location_acl_private.roots WHERE table_name<>'locations'
    UNION ALL
    SELECT child_table,child_column,parent_table,'location_acl_'||child_column||'_site_fk'
      FROM location_acl_private.links l WHERE EXISTS(SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema='public' AND c.table_name=l.child_table AND c.column_name='site_id')
    UNION ALL SELECT 'inventory_levels','catalog_item_id','catalog_items','location_acl_catalog_item_site_fk'
  LOOP
    SELECT count(*),(array_agg(c.oid))[1] INTO old_count,old_oid FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
      JOIN pg_attribute p ON p.attrelid=c.confrelid AND p.attnum=c.confkey[array_position(c.conkey,a.attnum)]
      WHERE c.contype='f' AND c.conrelid=to_regclass('public.'||link.child_table)
        AND c.confrelid=to_regclass('public.'||link.parent_table)
        AND c.conname<>link.constraint_name AND cardinality(c.conkey) IN (1,2)
        AND a.attname=link.child_column AND p.attname='id'
        AND NOT EXISTS(SELECT 1 FROM generate_subscripts(c.conkey,1) k
          JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=c.conkey[k]
          JOIN pg_attribute pa ON pa.attrelid=c.confrelid AND pa.attnum=c.confkey[k]
          WHERE ca.attname<>link.child_column AND (ca.attname<>'site_id' OR pa.attname<>'site_id'));
    IF old_count>1 THEN
      RAISE EXCEPTION 'Review duplicate legacy relationships on %.%',link.child_table,link.child_column;
    END IF;
    IF old_count=0 THEN CONTINUE; END IF;
    SELECT c.* INTO STRICT legacy FROM pg_constraint c WHERE c.oid=old_oid;
    IF cardinality(legacy.conkey)=2 THEN
      -- Purchases/register ledgers already deployed tenant composites, sometimes
      -- in (parent_id,site_id) order. Keep their OID, name and delete behavior.
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',link.child_table,link.constraint_name);
      CONTINUE;
    END IF;
    delete_action := CASE legacy.confdeltype WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN format('SET NULL (%I)',link.child_column)
      WHEN 'd' THEN format('SET DEFAULT (%I)',link.child_column)
      WHEN 'r' THEN 'RESTRICT' ELSE 'NO ACTION' END;
    update_action := CASE legacy.confupdtype WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT'
      WHEN 'r' THEN 'RESTRICT' ELSE 'NO ACTION' END;
    -- Rebuild rather than merely rename: preserve the deployed FK delete action,
    -- including scope roots whose historical action was not RESTRICT.
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',link.child_table,link.constraint_name);
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',link.child_table,legacy.conname);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I
      FOREIGN KEY(site_id,%I) REFERENCES public.%I(site_id,id)
      ON DELETE %s ON UPDATE %s %s NOT VALID',link.child_table,legacy.conname,link.child_column,
      link.parent_table,delete_action,update_action,
      CASE WHEN legacy.condeferrable THEN 'DEFERRABLE '||CASE WHEN legacy.condeferred
        THEN 'INITIALLY DEFERRED' ELSE 'INITIALLY IMMEDIATE' END ELSE 'NOT DEFERRABLE' END);
  END LOOP;
  -- Scope consistency now belongs to the locked inheritance/immutable triggers,
  -- not a second public relationship between the very same pair of tables.
  FOR link IN SELECT * FROM location_acl_private.links WHERE same_location LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',link.child_table,
      'location_acl_'||link.child_column||'_scope_fk');
  END LOOP;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;