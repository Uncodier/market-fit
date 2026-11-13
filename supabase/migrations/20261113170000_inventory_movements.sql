BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public.inventory_operation_requests (
  site_id uuid NOT NULL REFERENCES public.sites(id),
  request_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  operations jsonb NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (site_id, request_id)
);
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  request_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('transfer','receipt','adjustment')),
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id),
  item_name text NOT NULL,
  from_location_id uuid REFERENCES public.locations(id),
  to_location_id uuid NOT NULL REFERENCES public.locations(id),
  from_location_name text,
  to_location_name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity <> 0 AND abs(quantity) <= 1000000000),
  notes text CHECK (length(notes) <= 1000),
  purchase_id uuid REFERENCES public.purchases(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (site_id, request_id) REFERENCES public.inventory_operation_requests(site_id, request_id),
  CHECK ((kind = 'transfer' AND from_location_id IS NOT NULL AND from_location_id <> to_location_id AND quantity > 0)
    OR (kind <> 'transfer' AND from_location_id IS NULL)),
  CHECK ((kind = 'receipt' AND purchase_id IS NOT NULL AND quantity > 0) OR (kind <> 'receipt' AND purchase_id IS NULL))
);
CREATE INDEX inventory_movements_site_created_idx ON public.inventory_movements(site_id, created_at DESC);
CREATE INDEX inventory_movements_purchase_idx ON public.inventory_movements(purchase_id) WHERE purchase_id IS NOT NULL;
ALTER TABLE public.inventory_operation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_operation_requests, public.inventory_movements FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.inventory_movements TO authenticated;
CREATE POLICY inventory_movements_read ON public.inventory_movements FOR SELECT TO authenticated
  USING (coalesce(public.user_can(site_id,'select'),false)
    AND public.user_can_access_location(site_id,to_location_id)
    AND (from_location_id IS NULL OR public.user_can_access_location(site_id,from_location_id)));

CREATE FUNCTION public.apply_inventory_operations(p_site_id uuid, p_request_id uuid, p_operations jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE
  op jsonb; expanded jsonb := '[]'::jsonb; receipts uuid[] := ARRAY[]::uuid[];
  bill public.purchases%ROWTYPE; line record; prior public.inventory_operation_requests%ROWTYPE;
  item_id uuid; source_id uuid; target_id uuid; bill_id uuid; qty numeric;
  source_qty numeric; target_qty numeric; item_label text; source_label text; target_label text;
  movement_id uuid; movement_ids uuid[] := ARRAY[]::uuid[]; response jsonb;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'READ COMMITTED required' USING ERRCODE='40001';
  END IF;
  IF auth.uid() IS NULL OR current_setting('role',true) <> 'authenticated'
    OR NOT coalesce(public.user_can(p_site_id,'update'),false) THEN
    RAISE EXCEPTION 'Inventory access denied' USING ERRCODE='42501';
  END IF;
  IF p_request_id IS NULL OR p_site_id IS NULL OR jsonb_typeof(p_operations) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_operations) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid inventory batch' USING ERRCODE='22023';
  END IF;
  PERFORM public.lock_site_license(p_site_id);
  -- One bounded batch per site at a time; catalog locks also coordinate legacy writers.
  PERFORM pg_advisory_xact_lock(hashtextextended('inventory:' || p_site_id::text,0));
  SELECT * INTO prior FROM public.inventory_operation_requests
    WHERE site_id=p_site_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND AND (prior.actor_id <> auth.uid() OR prior.operations <> p_operations) THEN
    RAISE EXCEPTION 'Request ID conflict' USING ERRCODE='23505';
  END IF;
  -- Lock receipt parents in stable order before reading their server-owned lines.
  PERFORM 1 FROM public.purchases WHERE site_id=p_site_id AND id IN (
    SELECT (value->>'purchaseId')::uuid FROM jsonb_array_elements(p_operations) WHERE value->>'kind'='receipt'
  ) ORDER BY id FOR UPDATE;
  FOR op IN SELECT value FROM jsonb_array_elements(p_operations) LOOP
    IF jsonb_typeof(op) <> 'object' OR op->>'kind' NOT IN ('transfer','adjustment','receipt')
      OR op->>'kind' IS NULL OR NOT (op ? 'toLocationId') THEN
      RAISE EXCEPTION 'Invalid operation' USING ERRCODE='22023';
    END IF;
    target_id := (op->>'toLocationId')::uuid;
    IF target_id IS NULL OR NOT coalesce(public.user_can_access_location(p_site_id,target_id),false) THEN
      RAISE EXCEPTION 'Destination access denied' USING ERRCODE='42501';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.locations WHERE id=target_id AND site_id=p_site_id AND is_active IS TRUE) THEN
      RAISE EXCEPTION 'Invalid destination' USING ERRCODE='22023';
    END IF;
    IF op->>'kind'='receipt' THEN
      IF (op - ARRAY['kind','purchaseId','toLocationId']::text[]) <> '{}'::jsonb THEN
        RAISE EXCEPTION 'Unexpected receipt fields' USING ERRCODE='22023';
      END IF;
      bill_id := (op->>'purchaseId')::uuid;
      SELECT * INTO bill FROM public.purchases WHERE id=bill_id AND site_id=p_site_id;
      IF NOT FOUND OR NOT coalesce(public.user_can_access_location(p_site_id,bill.location_id),false) THEN
        RAISE EXCEPTION 'Bill access denied' USING ERRCODE='42501';
      END IF;
      IF bill.status='cancelled' THEN RAISE EXCEPTION 'Cancelled bill' USING ERRCODE='P0001'; END IF;
      IF bill.stock_received THEN
        IF bill.location_id IS DISTINCT FROM target_id THEN
          RAISE EXCEPTION 'Bill already received elsewhere' USING ERRCODE='P0001';
        END IF;
        CONTINUE;
      END IF;
      IF bill_id=ANY(receipts) THEN RAISE EXCEPTION 'Duplicate bill in batch' USING ERRCODE='22023'; END IF;
      receipts := array_append(receipts,bill_id);
      PERFORM 1 FROM public.purchase_items WHERE purchase_id=bill_id ORDER BY id FOR UPDATE;
      IF EXISTS(SELECT 1 FROM public.purchase_items pi LEFT JOIN public.catalog_items ci ON ci.id=pi.catalog_item_id
        WHERE pi.purchase_id=bill_id AND (pi.site_id<>p_site_id OR (pi.catalog_item_id IS NOT NULL AND ci.site_id<>p_site_id))) THEN
        RAISE EXCEPTION 'Invalid bill item tenant' USING ERRCODE='22023';
      END IF;
      IF EXISTS(SELECT 1 FROM public.purchase_items pi JOIN public.catalog_items ci ON ci.id=pi.catalog_item_id
        WHERE pi.purchase_id=bill_id AND ci.kind='product' AND (pi.quantity<=0
          OR pi.quantity::text IN ('NaN','Infinity','-Infinity') OR pi.quantity>1000000000)) THEN
        RAISE EXCEPTION 'Invalid bill product quantity' USING ERRCODE='22023';
      END IF;
      FOR line IN SELECT pi.catalog_item_id, sum(pi.quantity) AS quantity
        FROM public.purchase_items pi JOIN public.catalog_items ci ON ci.id=pi.catalog_item_id AND ci.site_id=p_site_id
        WHERE pi.purchase_id=bill_id AND pi.site_id=p_site_id AND ci.kind='product'
        GROUP BY pi.catalog_item_id ORDER BY pi.catalog_item_id LOOP
        IF line.quantity IS NULL OR line.quantity::text IN ('NaN','Infinity','-Infinity')
          OR line.quantity<=0 OR line.quantity>1000000000 THEN
          RAISE EXCEPTION 'Invalid bill quantity' USING ERRCODE='22023';
        END IF;
        expanded := expanded || jsonb_build_array(jsonb_build_object('kind','receipt','catalogItemId',line.catalog_item_id,
          'toLocationId',target_id,'quantity',line.quantity,'purchaseId',bill_id));
        IF jsonb_array_length(expanded)>1000 THEN RAISE EXCEPTION 'Too many product lines' USING ERRCODE='22023'; END IF;
      END LOOP;
      IF NOT FOUND THEN RAISE EXCEPTION 'No product lines' USING ERRCODE='P0001'; END IF;
    ELSE
      IF (op - ARRAY['kind','catalogItemId','fromLocationId','toLocationId','quantity','notes']::text[]) <> '{}'::jsonb
        OR jsonb_typeof(op->'quantity') IS DISTINCT FROM 'number'
        OR (op ? 'notes' AND (jsonb_typeof(op->'notes') IS DISTINCT FROM 'string' OR length(op->>'notes')>1000))
        OR (op->>'kind'='adjustment' AND op ? 'fromLocationId') THEN
        RAISE EXCEPTION 'Invalid operation fields' USING ERRCODE='22023';
      END IF;
      item_id := (op->>'catalogItemId')::uuid; qty := (op->>'quantity')::numeric;
      IF item_id IS NULL OR qty IS NULL OR qty=0 OR abs(qty)>1000000000 THEN
        RAISE EXCEPTION 'Invalid item or quantity' USING ERRCODE='22023';
      END IF;
      IF NOT EXISTS(SELECT 1 FROM public.catalog_items WHERE id=item_id AND site_id=p_site_id AND kind='product') THEN
        RAISE EXCEPTION 'Invalid product' USING ERRCODE='22023';
      END IF;
      IF op->>'kind'='transfer' THEN
        source_id := (op->>'fromLocationId')::uuid;
        IF source_id IS NULL OR NOT coalesce(public.user_can_access_location(p_site_id,source_id),false) THEN
          RAISE EXCEPTION 'Source access denied' USING ERRCODE='42501';
        END IF;
        IF source_id=target_id OR qty<=0 OR NOT EXISTS(SELECT 1 FROM public.locations
          WHERE id=source_id AND site_id=p_site_id AND is_active IS TRUE) THEN
          RAISE EXCEPTION 'Invalid transfer' USING ERRCODE='22023';
        END IF;
      END IF;
      expanded := expanded || jsonb_build_array(op);
    END IF;
  END LOOP;
  IF prior.request_id IS NOT NULL THEN
    RETURN prior.result || jsonb_build_object('alreadyApplied',true);
  END IF;
  IF jsonb_array_length(expanded)>1000 THEN RAISE EXCEPTION 'Too many product lines' USING ERRCODE='22023'; END IF;
  INSERT INTO public.inventory_operation_requests(site_id,request_id,actor_id,operations)
    VALUES(p_site_id,p_request_id,auth.uid(),p_operations);
  PERFORM 1 FROM public.catalog_items WHERE site_id=p_site_id AND id IN (
    SELECT (value->>'catalogItemId')::uuid FROM jsonb_array_elements(expanded)
  ) ORDER BY id FOR UPDATE;
  FOR op IN SELECT value FROM jsonb_array_elements(expanded) LOOP
    item_id := (op->>'catalogItemId')::uuid; target_id := (op->>'toLocationId')::uuid;
    source_id := (op->>'fromLocationId')::uuid; qty := (op->>'quantity')::numeric;
    SELECT name INTO item_label FROM public.catalog_items WHERE id=item_id AND site_id=p_site_id AND kind='product';
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid product' USING ERRCODE='22023'; END IF;
    SELECT name INTO target_label FROM public.locations WHERE id=target_id AND site_id=p_site_id;
    source_label := NULL;
    IF source_id IS NOT NULL THEN
      SELECT name INTO source_label FROM public.locations WHERE id=source_id AND site_id=p_site_id;
      SELECT quantity INTO source_qty FROM public.inventory_levels
        WHERE site_id=p_site_id AND catalog_item_id=item_id AND location_id=source_id FOR UPDATE;
      IF source_qty IS NULL OR source_qty<qty THEN RAISE EXCEPTION 'Insufficient inventory' USING ERRCODE='P0001'; END IF;
      UPDATE public.inventory_levels SET quantity=quantity-qty,updated_at=clock_timestamp()
        WHERE site_id=p_site_id AND catalog_item_id=item_id AND location_id=source_id;
    END IF;
    INSERT INTO public.inventory_levels(site_id,catalog_item_id,location_id,quantity)
      VALUES(p_site_id,item_id,target_id,0) ON CONFLICT (catalog_item_id,location_id) DO NOTHING;
    SELECT quantity INTO target_qty FROM public.inventory_levels
      WHERE site_id=p_site_id AND catalog_item_id=item_id AND location_id=target_id FOR UPDATE;
    IF target_qty IS NULL THEN RAISE EXCEPTION 'Invalid destination tenant' USING ERRCODE='23503'; END IF;
    IF target_qty+qty<0 THEN RAISE EXCEPTION 'Insufficient inventory' USING ERRCODE='P0001'; END IF;
    UPDATE public.inventory_levels SET quantity=quantity+qty,updated_at=clock_timestamp()
      WHERE site_id=p_site_id AND catalog_item_id=item_id AND location_id=target_id;
    INSERT INTO public.inventory_movements(site_id,request_id,actor_id,kind,catalog_item_id,item_name,
      from_location_id,to_location_id,from_location_name,to_location_name,quantity,notes,purchase_id)
      VALUES(p_site_id,p_request_id,auth.uid(),op->>'kind',item_id,item_label,source_id,target_id,
        source_label,target_label,qty,op->>'notes',(op->>'purchaseId')::uuid) RETURNING id INTO movement_id;
    movement_ids := array_append(movement_ids,movement_id);
  END LOOP;
  UPDATE public.purchases SET stock_received=true,location_id=(
    SELECT (value->>'toLocationId')::uuid FROM jsonb_array_elements(p_operations)
      WHERE value->>'kind'='receipt' AND (value->>'purchaseId')::uuid=purchases.id LIMIT 1
  ),updated_at=clock_timestamp() WHERE site_id=p_site_id AND id=ANY(receipts);
  response := jsonb_build_object('success',true,'requestId',p_request_id,'movementIds',to_jsonb(movement_ids),'alreadyApplied',false);
  UPDATE public.inventory_operation_requests SET result=response WHERE site_id=p_site_id AND request_id=p_request_id;
  RETURN response;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_inventory_operations(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.apply_inventory_operations(uuid,uuid,jsonb) TO authenticated;
COMMIT;