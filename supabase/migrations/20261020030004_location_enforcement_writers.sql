BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.transfer_location_inventory(
  p_site_id uuid, p_catalog_item_id uuid, p_from_location_id uuid,
  p_to_location_id uuid, p_quantity numeric
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE source_quantity numeric; target_quantity numeric;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Inventory transfer requires READ COMMITTED' USING ERRCODE='40001';
  END IF;
  PERFORM public.lock_site_license(p_site_id);
  IF auth.uid() IS NULL OR current_setting('role',true) <> 'authenticated'
    OR NOT coalesce(public.user_can(p_site_id,'update'),false)
    OR NOT public.user_can_access_location(p_site_id,p_from_location_id)
    OR NOT public.user_can_access_location(p_site_id,p_to_location_id) THEN
    RAISE EXCEPTION 'Inventory transfer access denied' USING ERRCODE='42501';
  END IF;
  IF p_from_location_id IS NULL OR p_to_location_id IS NULL
    OR p_from_location_id=p_to_location_id OR p_quantity IS NULL
    OR p_quantity::text IN ('NaN','Infinity','-Infinity') OR p_quantity<=0 OR p_quantity>1000000000 THEN
    RAISE EXCEPTION 'Two distinct locations and a positive finite quantity are required' USING ERRCODE='22023';
  END IF;
  -- Serialize per catalog item, including creation of a missing destination row.
  -- The source and destination mutate in one transaction, never sequential HTTP.
  PERFORM 1 FROM public.catalog_items WHERE id=p_catalog_item_id AND site_id=p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Catalog item must belong to this site' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.inventory_levels WHERE site_id=p_site_id
    AND catalog_item_id=p_catalog_item_id AND location_id IN (p_from_location_id,p_to_location_id)
    ORDER BY location_id FOR UPDATE;
  SELECT quantity INTO source_quantity FROM public.inventory_levels
    WHERE site_id=p_site_id AND catalog_item_id=p_catalog_item_id AND location_id=p_from_location_id;
  IF source_quantity IS NULL OR source_quantity<p_quantity THEN
    RAISE EXCEPTION 'Insufficient inventory' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.inventory_levels(site_id,catalog_item_id,location_id,quantity)
    VALUES(p_site_id,p_catalog_item_id,p_to_location_id,0)
    ON CONFLICT (catalog_item_id,location_id) DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM public.inventory_levels WHERE site_id=p_site_id
    AND catalog_item_id=p_catalog_item_id AND location_id=p_to_location_id) THEN
    RAISE EXCEPTION 'Inventory destination tenant is inconsistent' USING ERRCODE='23503';
  END IF;
  UPDATE public.inventory_levels SET quantity=quantity-p_quantity,updated_at=clock_timestamp()
    WHERE site_id=p_site_id AND catalog_item_id=p_catalog_item_id AND location_id=p_from_location_id
    RETURNING quantity INTO source_quantity;
  UPDATE public.inventory_levels SET quantity=quantity+p_quantity,updated_at=clock_timestamp()
    WHERE site_id=p_site_id AND catalog_item_id=p_catalog_item_id AND location_id=p_to_location_id
    RETURNING quantity INTO target_quantity;
  RETURN jsonb_build_object('from_quantity',source_quantity,'to_quantity',target_quantity);
END;
$$;
REVOKE ALL ON FUNCTION public.transfer_location_inventory(uuid,uuid,uuid,uuid,numeric)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.transfer_location_inventory(uuid,uuid,uuid,uuid,numeric) TO authenticated;

-- Explicit manager remediation for unresolved roots. It is not a broad SQL
-- writer: table identifiers come from a closed registry and the old scope is NULL.
CREATE FUNCTION public.assign_location_scope(p_table text,p_id uuid,p_site_id uuid,p_location_id uuid)
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
  EXECUTE format('UPDATE public.%I SET %I=$1 WHERE id=$2 AND site_id=$3 AND %I IS NULL',
    p_table,scope_column,scope_column) USING p_location_id,p_id,p_site_id;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'Unresolved root not found' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('table',p_table,'id',p_id,'site_id',p_site_id,'location_id',p_location_id);
END;
$$;
REVOKE ALL ON FUNCTION public.assign_location_scope(text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.assign_location_scope(text,uuid,uuid,uuid) TO authenticated;

-- The existing assignment predicate is used to break deal_owners RLS recursion.
-- Retain that purpose without allowing restricted callers to probe another
-- actor's ownership on a blocked deal through a SECURITY DEFINER boolean RPC.
CREATE OR REPLACE FUNCTION public.is_deal_owner(p_deal_id uuid,p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT EXISTS(SELECT 1 FROM public.deal_owners o WHERE o.deal_id=p_deal_id AND o.user_id=p_user_id)
    AND (NOT public.current_user_has_location_restrictions() OR (
      p_user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.deals d WHERE d.id=p_deal_id
        AND public.user_can_access_location(d.site_id,d.location_id))
    ));
$$;
REVOKE ALL ON FUNCTION public.is_deal_owner(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_deal_owner(uuid,uuid) TO authenticated,service_role;
COMMIT;