BEGIN;
SET LOCAL lock_timeout = '5s';
-- Preserve the installed lifecycle while explicitly permitting unfulfilled lines.
DO $$
DECLARE source text; changed text;
BEGIN
  source := pg_get_functiondef('public.transition_inventory_transfer_order(uuid,uuid,uuid,jsonb)'::regprocedure);
  IF position('IF qty<=0 OR qty>1000000000 THEN' in source)=0
    OR position('PERFORM public.apply_location_inventory_delta(p_site_id,line.catalog_item_id,doc.from_location_id,-qty,false);' in source)=0
    OR position('next_status := CASE WHEN act=''dispatch'' THEN ''in_transit''' in source)=0 THEN
    RAISE EXCEPTION 'Unexpected transfer implementation; review partial dispatch migration';
  END IF;
  changed := replace(source,'IF qty<=0 OR qty>1000000000 THEN',
    'IF qty<0 OR (act=''receive'' AND qty=0) OR qty>1000000000 THEN');
  changed := replace(changed,
    'PERFORM public.apply_location_inventory_delta(p_site_id,line.catalog_item_id,doc.from_location_id,-qty,false);',
    'IF qty>0 THEN PERFORM public.apply_location_inventory_delta(p_site_id,line.catalog_item_id,doc.from_location_id,-qty,false); END IF;');
  changed := replace(changed,'next_status := CASE WHEN act=''dispatch'' THEN ''in_transit''',
    'IF act=''dispatch'' AND NOT EXISTS(SELECT 1 FROM public.inventory_transfer_lines WHERE order_id=p_order_id AND dispatched_quantity>0) THEN
      RAISE EXCEPTION ''Dispatch requires positive stock'' USING ERRCODE=''22023'';
    END IF;
    next_status := CASE WHEN act=''dispatch'' THEN ''in_transit''');
  EXECUTE changed;
END;
$$;
-- Zero-dispatched lines are immutable too once the document leaves approval.
CREATE OR REPLACE FUNCTION public.inventory_transfer_line_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF ROW(NEW.id,NEW.order_id,NEW.site_id,NEW.catalog_item_id,NEW.item_name,NEW.requested_quantity)
      IS DISTINCT FROM ROW(OLD.id,OLD.order_id,OLD.site_id,OLD.catalog_item_id,OLD.item_name,OLD.requested_quantity)
    OR NEW.received_quantity<OLD.received_quantity OR NEW.returned_quantity<OLD.returned_quantity
    OR NEW.written_off_quantity<OLD.written_off_quantity
    OR (NEW.dispatched_quantity<>OLD.dispatched_quantity AND (OLD.dispatched_quantity>0 OR EXISTS(
      SELECT 1 FROM public.inventory_transfer_orders WHERE id=OLD.order_id AND status NOT IN ('draft','requested','approved')))) THEN
    RAISE EXCEPTION 'Transfer line history is immutable' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.inventory_transfer_line_guard() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;