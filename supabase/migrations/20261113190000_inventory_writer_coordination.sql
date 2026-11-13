BEGIN;
SET LOCAL lock_timeout = '5s';

-- Preserve the original implementation while moving its public boundary behind
-- the license lock. No permission snapshot taken before a wait can authorize a write.
ALTER FUNCTION public.apply_inventory_operations(uuid,uuid,jsonb) RENAME TO apply_inventory_operations_locked;
REVOKE ALL ON FUNCTION public.apply_inventory_operations_locked(uuid,uuid,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.apply_inventory_operations(p_site_id uuid,p_request_id uuid,p_operations jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'READ COMMITTED required' USING ERRCODE='40001';
  END IF;
  IF auth.uid() IS NULL OR current_setting('role',true) <> 'authenticated' THEN
    RAISE EXCEPTION 'Inventory access denied' USING ERRCODE='42501';
  END IF;
  IF p_site_id IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_operations) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_operations) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid inventory batch' USING ERRCODE='22023';
  END IF;
  PERFORM public.lock_site_license(p_site_id);
  IF NOT coalesce(public.user_can(p_site_id,'update'),false) THEN
    RAISE EXCEPTION 'Inventory access denied' USING ERRCODE='42501';
  END IF;
  RETURN public.apply_inventory_operations_locked(p_site_id,p_request_id,p_operations);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_inventory_operations(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.apply_inventory_operations(uuid,uuid,jsonb) TO authenticated;

-- Authorized server commerce paths and user-scoped writers share the product
-- lock with transfers/receipts. Apply the delta against the locked current value,
-- never against a quantity read by an earlier HTTP request.
CREATE FUNCTION public.apply_location_inventory_delta(
  p_site_id uuid,p_catalog_item_id uuid,p_location_id uuid,p_delta numeric,p_floor_zero boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE current_quantity numeric; result_quantity numeric; actor_role text := current_setting('role',true);
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'READ COMMITTED required' USING ERRCODE='40001';
  END IF;
  IF actor_role NOT IN ('authenticated','service_role') OR actor_role IS NULL
    OR (actor_role='authenticated' AND auth.uid() IS NULL) THEN
    RAISE EXCEPTION 'Inventory access denied' USING ERRCODE='42501';
  END IF;
  IF p_site_id IS NULL OR p_catalog_item_id IS NULL OR p_location_id IS NULL OR p_delta IS NULL
    OR p_delta::text IN ('NaN','Infinity','-Infinity') OR p_delta=0 OR abs(p_delta)>1000000000
    OR p_floor_zero IS NULL THEN
    RAISE EXCEPTION 'Invalid inventory delta' USING ERRCODE='22023';
  END IF;
  PERFORM public.lock_site_license(p_site_id);
  IF actor_role='authenticated' AND (NOT coalesce(public.user_can(p_site_id,'update'),false)
    OR NOT coalesce(public.user_can_access_location(p_site_id,p_location_id),false)) THEN
    RAISE EXCEPTION 'Inventory access denied' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.locations WHERE id=p_location_id AND site_id=p_site_id) THEN
    RAISE EXCEPTION 'Invalid inventory location' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.catalog_items WHERE id=p_catalog_item_id AND site_id=p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid inventory product' USING ERRCODE='22023'; END IF;
  INSERT INTO public.inventory_levels(site_id,catalog_item_id,location_id,quantity)
    VALUES(p_site_id,p_catalog_item_id,p_location_id,0)
    ON CONFLICT (catalog_item_id,location_id) DO NOTHING;
  SELECT quantity INTO current_quantity FROM public.inventory_levels
    WHERE site_id=p_site_id AND catalog_item_id=p_catalog_item_id AND location_id=p_location_id FOR UPDATE;
  IF current_quantity IS NULL OR current_quantity::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Invalid inventory level' USING ERRCODE='23503';
  END IF;
  result_quantity := current_quantity+p_delta;
  IF p_floor_zero THEN result_quantity := greatest(0,result_quantity); END IF;
  IF result_quantity<0 THEN RAISE EXCEPTION 'Insufficient inventory' USING ERRCODE='P0001'; END IF;
  UPDATE public.inventory_levels SET quantity=result_quantity,updated_at=clock_timestamp()
    WHERE site_id=p_site_id AND catalog_item_id=p_catalog_item_id AND location_id=p_location_id;
  RETURN jsonb_build_object('quantity',result_quantity);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_location_inventory_delta(uuid,uuid,uuid,numeric,boolean)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.apply_location_inventory_delta(uuid,uuid,uuid,numeric,boolean) TO authenticated,service_role;
COMMIT;