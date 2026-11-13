BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.purchase_items ADD COLUMN received_quantity numeric NOT NULL DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN stock_receipt_location_id uuid REFERENCES public.locations(id);
-- Historical completion is a budget backfill only: no movements or inventory credits.
UPDATE public.purchase_items pi SET received_quantity=pi.quantity
FROM public.purchases p, public.catalog_items ci
WHERE p.id=pi.purchase_id AND p.stock_received IS TRUE
  AND ci.id=pi.catalog_item_id AND ci.kind='product';
UPDATE public.purchases SET stock_receipt_location_id=location_id WHERE stock_received IS TRUE;
ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_received_budget
  CHECK (received_quantity::text NOT IN ('NaN','Infinity','-Infinity')
    AND received_quantity>=0 AND (received_quantity=0 OR received_quantity<=quantity));
ALTER TABLE public.inventory_movements ADD COLUMN purchase_item_id uuid REFERENCES public.purchase_items(id);
ALTER TABLE public.inventory_movements DROP CONSTRAINT inventory_receiving_responsibility_transfer;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_receiving_responsibility_transfer
  CHECK (receiving_user_id IS NULL OR kind IN ('transfer','receipt'));
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movement_purchase_line
  CHECK (purchase_item_id IS NULL OR (kind='receipt' AND receiving_user_id IS NOT NULL AND receiving_user_name IS NOT NULL));

CREATE TABLE public.purchase_inventory_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id),
  purchase_item_id uuid NOT NULL REFERENCES public.purchase_items(id),
  request_id uuid NOT NULL,
  movement_id uuid NOT NULL UNIQUE REFERENCES public.inventory_movements(id),
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id),
  item_name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity>0 AND quantity<=1000000000
    AND quantity::text NOT IN ('NaN','Infinity','-Infinity')),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  location_name text NOT NULL,
  actor_id uuid NOT NULL,
  receiving_user_id uuid NOT NULL,
  receiving_user_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(site_id,request_id,purchase_item_id),
  FOREIGN KEY(site_id,request_id) REFERENCES public.inventory_operation_requests(site_id,request_id)
);
CREATE INDEX purchase_inventory_receipts_purchase ON public.purchase_inventory_receipts(purchase_id,purchase_item_id);
ALTER TABLE public.purchase_inventory_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.purchase_inventory_receipts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.purchase_inventory_receipts TO authenticated;
CREATE POLICY purchase_inventory_receipts_read ON public.purchase_inventory_receipts FOR SELECT TO authenticated
  USING (coalesce(public.user_can(site_id,'select'),false)
    AND coalesce(public.user_can_access_location(site_id,location_id),false)
    AND EXISTS(SELECT 1 FROM public.purchases p WHERE p.id=purchase_id AND p.site_id=purchase_inventory_receipts.site_id
      AND coalesce(public.user_can_access_location(p.site_id,p.location_id),false)));
CREATE FUNCTION public.purchase_inventory_receipt_immutable() RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN RAISE EXCEPTION 'Purchase receipt history is immutable' USING ERRCODE='42501'; END;
$$;
CREATE TRIGGER purchase_inventory_receipt_immutable BEFORE UPDATE OR DELETE ON public.purchase_inventory_receipts
  FOR EACH ROW EXECUTE FUNCTION public.purchase_inventory_receipt_immutable();
REVOKE ALL ON FUNCTION public.purchase_inventory_receipt_immutable() FROM PUBLIC,anon,authenticated,service_role;

-- Invoker security distinguishes direct Data API budget edits from the RPC.
CREATE FUNCTION public.purchase_inventory_budget_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.received_quantity<OLD.received_quantity
    OR (NEW.received_quantity IS DISTINCT FROM OLD.received_quantity AND current_user IN ('authenticated','anon','service_role'))) THEN
    RAISE EXCEPTION 'Received quantity is immutable outside receipt operations' USING ERRCODE='42501';
  END IF;
  IF TG_OP='INSERT' AND NEW.received_quantity<>0 THEN
    RAISE EXCEPTION 'New lines cannot be received' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER purchase_inventory_budget_guard BEFORE INSERT OR UPDATE ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.purchase_inventory_budget_guard();
REVOKE ALL ON FUNCTION public.purchase_inventory_budget_guard() FROM PUBLIC,anon,authenticated,service_role;

-- Parent locking makes insert/delete/identity edits serialize with receiving,
-- independently of caller RLS visibility of the parent and sibling lines.
CREATE FUNCTION public.purchase_inventory_line_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE parent_id uuid; frozen boolean;
BEGIN
  FOR parent_id IN SELECT DISTINCT id FROM (VALUES
    (CASE WHEN TG_OP<>'INSERT' THEN OLD.purchase_id END),
    (CASE WHEN TG_OP<>'DELETE' THEN NEW.purchase_id END)) parents(id) WHERE id IS NOT NULL ORDER BY id LOOP
    PERFORM 1 FROM public.purchases WHERE id=parent_id FOR UPDATE;
    SELECT stock_received IS TRUE OR stock_receipt_location_id IS NOT NULL OR EXISTS(
      SELECT 1 FROM public.purchase_items WHERE purchase_id=parent_id AND received_quantity>0)
      INTO frozen FROM public.purchases WHERE id=parent_id;
    IF frozen AND (TG_OP IN ('INSERT','DELETE') OR ROW(NEW.id,NEW.purchase_id,NEW.site_id,NEW.catalog_item_id,NEW.quantity)
      IS DISTINCT FROM ROW(OLD.id,OLD.purchase_id,OLD.site_id,OLD.catalog_item_id,OLD.quantity)) THEN
      RAISE EXCEPTION 'Received bill lines are immutable' USING ERRCODE='P0001';
    END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER purchase_inventory_line_guard BEFORE INSERT OR UPDATE OR DELETE ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.purchase_inventory_line_guard();
REVOKE ALL ON FUNCTION public.purchase_inventory_line_guard() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.purchase_inventory_completion_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
BEGIN
  IF OLD.stock_received IS TRUE AND NEW.stock_received IS DISTINCT FROM true
    OR OLD.stock_receipt_location_id IS NOT NULL AND ROW(NEW.stock_receipt_location_id,NEW.location_id,NEW.site_id)
      IS DISTINCT FROM ROW(OLD.stock_receipt_location_id,OLD.location_id,OLD.site_id) THEN
    RAISE EXCEPTION 'Receipt destination and completion are immutable' USING ERRCODE='P0001';
  END IF;
  IF NEW.stock_received IS TRUE AND EXISTS(SELECT 1 FROM public.purchase_items WHERE purchase_id=NEW.id AND received_quantity>0)
    AND EXISTS(SELECT 1 FROM public.purchase_items pi JOIN public.catalog_items ci ON ci.id=pi.catalog_item_id
      WHERE pi.purchase_id=NEW.id AND ci.kind='product' AND pi.received_quantity<pi.quantity) THEN
    RAISE EXCEPTION 'Bill has partial receipts' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER purchase_inventory_completion_guard BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.purchase_inventory_completion_guard();
REVOKE ALL ON FUNCTION public.purchase_inventory_completion_guard() FROM PUBLIC,anon,authenticated,service_role;

-- Legacy full receipts still work, but synchronize budgets only after completion.
CREATE FUNCTION public.purchase_inventory_legacy_complete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
BEGIN
  IF NEW.stock_received IS TRUE AND OLD.stock_received IS DISTINCT FROM true THEN
    UPDATE public.purchase_items pi SET received_quantity=pi.quantity FROM public.catalog_items ci
      WHERE pi.purchase_id=NEW.id AND ci.id=pi.catalog_item_id AND ci.kind='product' AND pi.received_quantity=0;
    UPDATE public.purchases SET stock_receipt_location_id=NEW.location_id WHERE id=NEW.id AND stock_receipt_location_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER purchase_inventory_legacy_complete AFTER UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.purchase_inventory_legacy_complete();
REVOKE ALL ON FUNCTION public.purchase_inventory_legacy_complete() FROM PUBLIC,anon,authenticated,service_role;

-- Guard the private legacy expansion before any stock effect, without rewriting
-- the transfer/checkout implementation or weakening its existing admission checks.
DO $$
DECLARE source text; marker text := 'IF bill.stock_received THEN';
BEGIN
  source := pg_get_functiondef('public.apply_inventory_operations_locked(uuid,uuid,jsonb)'::regprocedure);
  IF position(marker in source)=0 THEN RAISE EXCEPTION 'Unexpected legacy receipt implementation'; END IF;
  EXECUTE replace(source,marker,
    'IF NOT coalesce(bill.stock_received,false) AND (bill.stock_receipt_location_id IS NOT NULL OR EXISTS(
      SELECT 1 FROM public.purchase_items WHERE purchase_id=bill_id AND received_quantity>0)) THEN
      RAISE EXCEPTION ''Bill has partial receipts; use per-line receiving'' USING ERRCODE=''P0001'';
    END IF; ' || marker);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_inventory_operations_locked(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- Incremental quantities only. A site updater can assign any eligible receiver;
-- the actor need not be the receiver. Names and product identity are server-owned.
CREATE FUNCTION public.receive_bill_inventory_lines(
  p_site_id uuid,p_purchase_id uuid,p_request_id uuid,p_location_id uuid,p_receiving_user_id uuid,p_lines jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE
  bill public.purchases%ROWTYPE; prior public.inventory_operation_requests%ROWTYPE;
  payload jsonb; entry jsonb; line record; qty numeric; label text; receiver_label text;
  movement_id uuid; movement_ids uuid[] := ARRAY[]::uuid[]; response jsonb;
BEGIN
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'READ COMMITTED required' USING ERRCODE='40001';
  END IF;
  IF auth.uid() IS NULL OR current_setting('role',true)<>'authenticated' THEN
    RAISE EXCEPTION 'Inventory access denied' USING ERRCODE='42501';
  END IF;
  IF p_site_id IS NULL OR p_purchase_id IS NULL OR p_request_id IS NULL OR p_location_id IS NULL
    OR p_receiving_user_id IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid bill receipt' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_lines) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid receipt line count' USING ERRCODE='22023';
  END IF;
  PERFORM public.lock_site_license(p_site_id);
  IF NOT coalesce(public.user_can(p_site_id,'update'),false)
    OR NOT coalesce(public.user_can_access_location(p_site_id,p_location_id),false) THEN
    RAISE EXCEPTION 'Inventory access denied' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('inventory:' || p_site_id::text,0));
  SELECT * INTO bill FROM public.purchases WHERE id=p_purchase_id AND site_id=p_site_id FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(public.user_can_access_location(p_site_id,bill.location_id),false) THEN
    RAISE EXCEPTION 'Bill access denied' USING ERRCODE='42501';
  END IF;
  SELECT name INTO label FROM public.locations WHERE id=p_location_id AND site_id=p_site_id AND is_active IS TRUE FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid destination' USING ERRCODE='22023'; END IF;
  receiver_label := public.inventory_receiver_name(p_site_id,p_receiving_user_id,p_location_id);
  FOR entry IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR (entry-ARRAY['purchaseItemId','quantity']::text[])<>'{}'::jsonb
      OR jsonb_typeof(entry->'purchaseItemId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(entry->'quantity') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Invalid receipt line fields' USING ERRCODE='22023';
    END IF;
    PERFORM (entry->>'purchaseItemId')::uuid;
    qty := (entry->>'quantity')::numeric;
    IF qty<=0 OR qty>1000000000 OR qty::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION 'Invalid receipt quantity' USING ERRCODE='22023';
    END IF;
  END LOOP;
  IF (SELECT count(DISTINCT (value->>'purchaseItemId')::uuid) FROM jsonb_array_elements(p_lines))<>jsonb_array_length(p_lines) THEN
    RAISE EXCEPTION 'Duplicate receipt line' USING ERRCODE='22023';
  END IF;
  payload := jsonb_build_object('operation','receive_bill_inventory_lines','purchaseId',p_purchase_id,
    'locationId',p_location_id,'receivingUserId',p_receiving_user_id,'lines',p_lines);
  SELECT * INTO prior FROM public.inventory_operation_requests WHERE site_id=p_site_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF prior.actor_id<>auth.uid() OR prior.operations<>payload THEN
      RAISE EXCEPTION 'Request ID conflict' USING ERRCODE='23505';
    END IF;
    RETURN prior.result || jsonb_build_object('alreadyApplied',true);
  END IF;
  IF bill.status='cancelled' OR bill.stock_received IS TRUE THEN
    RAISE EXCEPTION 'Bill is cancelled or fully received' USING ERRCODE='P0001';
  END IF;
  IF bill.stock_receipt_location_id IS NOT NULL AND bill.stock_receipt_location_id<>p_location_id THEN
    RAISE EXCEPTION 'Receipt destination is immutable' USING ERRCODE='P0001';
  END IF;
  PERFORM 1 FROM public.purchase_items WHERE purchase_id=p_purchase_id ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.catalog_items WHERE id IN (SELECT catalog_item_id FROM public.purchase_items
    WHERE purchase_id=p_purchase_id) ORDER BY id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.purchase_items pi LEFT JOIN public.catalog_items ci ON ci.id=pi.catalog_item_id
    WHERE pi.purchase_id=p_purchase_id AND (pi.site_id IS DISTINCT FROM p_site_id
      OR (pi.catalog_item_id IS NOT NULL AND ci.site_id IS DISTINCT FROM p_site_id))) THEN
    RAISE EXCEPTION 'Invalid bill item tenant' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.purchase_items pi JOIN public.catalog_items ci ON ci.id=pi.catalog_item_id
    WHERE pi.purchase_id=p_purchase_id AND ci.kind='product' AND (pi.quantity IS NULL OR pi.quantity<=0
      OR pi.quantity>1000000000 OR pi.quantity::text IN ('NaN','Infinity','-Infinity'))) THEN
    RAISE EXCEPTION 'Invalid bill product quantity' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.inventory_operation_requests(site_id,request_id,actor_id,operations)
    VALUES(p_site_id,p_request_id,auth.uid(),payload);
  FOR entry IN SELECT value FROM jsonb_array_elements(p_lines) ORDER BY (value->>'purchaseItemId')::uuid LOOP
    SELECT pi.*,ci.name AS item_name INTO line FROM public.purchase_items pi JOIN public.catalog_items ci ON ci.id=pi.catalog_item_id
      WHERE pi.id=(entry->>'purchaseItemId')::uuid AND pi.purchase_id=p_purchase_id AND pi.site_id=p_site_id
        AND ci.site_id=p_site_id AND ci.kind='product';
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid bill product line' USING ERRCODE='22023'; END IF;
    qty := (entry->>'quantity')::numeric;
    IF line.quantity IS NULL OR line.quantity<=0 OR line.quantity::text IN ('NaN','Infinity','-Infinity')
      OR qty>line.quantity-line.received_quantity THEN
      RAISE EXCEPTION 'Receipt exceeds remaining quantity' USING ERRCODE='P0001';
    END IF;
    PERFORM public.apply_location_inventory_delta(p_site_id,line.catalog_item_id,p_location_id,qty,false);
    INSERT INTO public.inventory_movements(site_id,request_id,actor_id,kind,catalog_item_id,item_name,
      to_location_id,to_location_name,quantity,purchase_id,purchase_item_id,receiving_user_id,receiving_user_name)
      VALUES(p_site_id,p_request_id,auth.uid(),'receipt',line.catalog_item_id,line.item_name,p_location_id,label,qty,
        p_purchase_id,line.id,p_receiving_user_id,receiver_label) RETURNING id INTO movement_id;
    INSERT INTO public.purchase_inventory_receipts(site_id,purchase_id,purchase_item_id,request_id,movement_id,
      catalog_item_id,item_name,quantity,location_id,location_name,actor_id,receiving_user_id,receiving_user_name)
      VALUES(p_site_id,p_purchase_id,line.id,p_request_id,movement_id,line.catalog_item_id,line.item_name,qty,
        p_location_id,label,auth.uid(),p_receiving_user_id,receiver_label);
    UPDATE public.purchase_items SET received_quantity=received_quantity+qty WHERE id=line.id;
    movement_ids := array_append(movement_ids,movement_id);
  END LOOP;
  UPDATE public.purchases SET location_id=p_location_id,stock_receipt_location_id=p_location_id,
    stock_received=NOT EXISTS(SELECT 1 FROM public.purchase_items pi JOIN public.catalog_items ci ON ci.id=pi.catalog_item_id
      WHERE pi.purchase_id=p_purchase_id AND ci.kind='product' AND pi.received_quantity<pi.quantity),
    updated_at=clock_timestamp() WHERE id=p_purchase_id;
  response := jsonb_build_object('success',true,'requestId',p_request_id,'movementIds',to_jsonb(movement_ids),'alreadyApplied',false);
  UPDATE public.inventory_operation_requests SET result=response WHERE site_id=p_site_id AND request_id=p_request_id;
  RETURN response;
END;
$$;
REVOKE ALL ON FUNCTION public.receive_bill_inventory_lines(uuid,uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.receive_bill_inventory_lines(uuid,uuid,uuid,uuid,uuid,jsonb) TO authenticated;
COMMIT;