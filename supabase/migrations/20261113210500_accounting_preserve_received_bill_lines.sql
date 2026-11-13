BEGIN;
SET LOCAL lock_timeout = '5s';

-- Patch the implementation, not the location-ACL wrapper. Its historical
-- private name is derived from the public OID; preserve that boundary and grants.
DO $migration$
DECLARE
  entry_oid oid := 'public.accounting_update_purchase_items(uuid,uuid,timestamptz,jsonb,jsonb)'::regprocedure;
  implementation oid; source text; wrapper text; start_at integer; end_at integer;
  start_marker text := 'DELETE FROM public.purchase_items WHERE purchase_id = p_purchase_id AND site_id = p_site_id;';
  end_marker text := 'UPDATE public.purchases SET title = replacement.title';
  replacement text := $patch$
  IF previous.stock_received IS TRUE OR previous.stock_receipt_location_id IS NOT NULL OR EXISTS(
    SELECT 1 FROM public.purchase_items WHERE purchase_id=p_purchase_id AND received_quantity>0) THEN
    -- No writes to frozen lines, even for identical duplicates without IDs.
    -- Compare multisets (not sets) so repeated catalog items cannot disappear.
    PERFORM 1 FROM public.purchase_items WHERE purchase_id=p_purchase_id ORDER BY id FOR UPDATE;
    IF EXISTS(SELECT 1 FROM public.purchase_items WHERE purchase_id=p_purchase_id AND site_id IS DISTINCT FROM p_site_id)
      OR EXISTS(
        WITH incoming AS (
          SELECT (value->>'catalog_item_id')::uuid catalog_item_id, value->>'name' name,
            (value->>'quantity')::numeric quantity, (value->>'unit_cost')::numeric unit_cost,
            round((value->>'quantity')::numeric*(value->>'unit_cost')::numeric,2) subtotal
          FROM jsonb_array_elements(p_items)
        ), stored AS (
          SELECT pi.catalog_item_id,pi.name,pi.quantity,pi.unit_cost,pi.subtotal
          FROM public.purchase_items pi WHERE pi.purchase_id=p_purchase_id
        ) SELECT 1 FROM ((TABLE incoming EXCEPT ALL TABLE stored) UNION ALL
          (TABLE stored EXCEPT ALL TABLE incoming)) differences
      ) THEN
      RAISE EXCEPTION 'Received bill items must remain unchanged' USING ERRCODE='P0001';
    END IF;
    -- Legacy editors omit IDs. If supplied, they must preserve exact identity,
    -- not merely permute received budgets among equal-looking catalog rows.
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) e WHERE e ? 'id') THEN
      IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) e WHERE e->>'id' IS NULL)
        OR (SELECT count(DISTINCT (e->>'id')::uuid) FROM jsonb_array_elements(p_items) e)<>jsonb_array_length(p_items)
        OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) e WHERE NOT EXISTS(
          SELECT 1 FROM public.purchase_items pi WHERE pi.id=(e->>'id')::uuid AND pi.purchase_id=p_purchase_id
            AND ROW(pi.catalog_item_id,pi.name,pi.quantity,pi.unit_cost)
              IS NOT DISTINCT FROM ROW((e->>'catalog_item_id')::uuid,e->>'name',
                (e->>'quantity')::numeric,(e->>'unit_cost')::numeric))) THEN
        RAISE EXCEPTION 'Received bill item identity must remain unchanged' USING ERRCODE='P0001';
      END IF;
    END IF;
  ELSE
  $patch$;
BEGIN
  source := pg_get_functiondef(entry_oid);
  implementation := entry_oid;
  IF position(start_marker in source)=0 THEN
    wrapper := source;
    implementation := to_regprocedure(format('location_acl_private.original_%s(uuid,uuid,timestamptz,jsonb,jsonb)',entry_oid));
    IF implementation IS NULL OR position('location_acl_assert_unscoped_rpc' in wrapper)=0
      OR position(format('location_acl_private.original_%s(',entry_oid) in wrapper)=0 THEN
      RAISE EXCEPTION 'Unexpected accounting location wrapper';
    END IF;
    source := pg_get_functiondef(implementation);
  END IF;
  start_at := position(start_marker in source);
  end_at := position(end_marker in source);
  IF start_at=0 OR end_at<=start_at OR position('Received bill items must remain unchanged' in source)>0 THEN
    RAISE EXCEPTION 'Unexpected accounting item replacement implementation';
  END IF;
  source := substring(source FROM 1 FOR start_at-1) || replacement ||
    substring(source FROM start_at FOR end_at-start_at) || 'END IF; ' || substring(source FROM end_at);
  EXECUTE source;
END;
$migration$;
NOTIFY pgrst, 'reload schema';
COMMIT;
