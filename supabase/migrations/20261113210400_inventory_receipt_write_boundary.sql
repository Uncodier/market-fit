BEGIN;
SET LOCAL lock_timeout = '5s';

-- Not a caller-settable GUC: only authorized receipt implementations create
-- capabilities, scoped to this transaction, bill and authenticated actor.
CREATE SCHEMA inventory_receipt_private;
REVOKE ALL ON SCHEMA inventory_receipt_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE inventory_receipt_private.writes (
  transaction_id bigint NOT NULL, purchase_id uuid NOT NULL, actor_id uuid NOT NULL,
  legacy boolean NOT NULL, PRIMARY KEY(transaction_id,purchase_id)
);
REVOKE ALL ON inventory_receipt_private.writes FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.purchase_inventory_budget_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
BEGIN
  IF TG_OP='INSERT' AND NEW.received_quantity<>0 THEN
    RAISE EXCEPTION 'New lines cannot be received' USING ERRCODE='42501';
  END IF;
  IF TG_OP='UPDATE' AND (NEW.received_quantity<OLD.received_quantity OR
    (NEW.received_quantity IS DISTINCT FROM OLD.received_quantity AND NOT EXISTS(
      SELECT 1 FROM inventory_receipt_private.writes WHERE transaction_id=txid_current()
        AND purchase_id=NEW.purchase_id AND actor_id=auth.uid()))) THEN
    RAISE EXCEPTION 'Received quantity is immutable outside receipt operations' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_inventory_completion_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.stock_received IS TRUE OR NEW.stock_receipt_location_id IS NOT NULL THEN
      RAISE EXCEPTION 'New bills cannot be received' USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.stock_received IS TRUE AND NEW.stock_received IS DISTINCT FROM true
    OR OLD.stock_receipt_location_id IS NOT NULL AND ROW(NEW.stock_receipt_location_id,NEW.location_id,NEW.site_id)
      IS DISTINCT FROM ROW(OLD.stock_receipt_location_id,OLD.location_id,OLD.site_id) THEN
    RAISE EXCEPTION 'Receipt destination and completion are immutable' USING ERRCODE='P0001';
  END IF;
  IF ROW(NEW.stock_received,NEW.stock_receipt_location_id)
    IS DISTINCT FROM ROW(OLD.stock_received,OLD.stock_receipt_location_id) AND NOT EXISTS(
      SELECT 1 FROM inventory_receipt_private.writes WHERE transaction_id=txid_current()
        AND purchase_id=NEW.id AND actor_id=auth.uid()) THEN
    RAISE EXCEPTION 'Receipt operation required' USING ERRCODE='42501';
  END IF;
  IF NEW.stock_received IS TRUE AND EXISTS(SELECT 1 FROM public.purchase_items WHERE purchase_id=NEW.id AND received_quantity>0)
    AND EXISTS(SELECT 1 FROM public.purchase_items pi JOIN public.catalog_items ci ON ci.id=pi.catalog_item_id
      WHERE pi.purchase_id=NEW.id AND ci.kind='product' AND pi.received_quantity<pi.quantity) THEN
    RAISE EXCEPTION 'Bill has partial receipts' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER purchase_inventory_completion_guard ON public.purchases;
CREATE TRIGGER purchase_inventory_completion_guard BEFORE INSERT OR UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.purchase_inventory_completion_guard();

CREATE OR REPLACE FUNCTION public.purchase_inventory_legacy_complete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
BEGIN
  IF NEW.stock_received IS TRUE AND OLD.stock_received IS DISTINCT FROM true AND EXISTS(
    SELECT 1 FROM inventory_receipt_private.writes WHERE transaction_id=txid_current()
      AND purchase_id=NEW.id AND actor_id=auth.uid() AND legacy) THEN
    UPDATE public.purchase_items pi SET received_quantity=pi.quantity FROM public.catalog_items ci
      WHERE pi.purchase_id=NEW.id AND ci.id=pi.catalog_item_id AND ci.kind='product' AND pi.received_quantity=0;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.purchase_inventory_budget_guard(),
  public.purchase_inventory_completion_guard(),public.purchase_inventory_legacy_complete()
  FROM PUBLIC,anon,authenticated,service_role;


-- Preserve earlier locking, authorization, replay and transfer writer fixes.
-- Fail closed on drift rather than installing a partial patch.
DO $$
DECLARE source text; marker text;
BEGIN
  source := pg_get_functiondef('public.receive_bill_inventory_lines(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure);
  marker := 'FOR entry IN SELECT value FROM jsonb_array_elements(p_lines) ORDER BY';
  IF position(marker in source)=0 OR position('SET location_id=p_location_id,stock_receipt_location_id=p_location_id' in source)=0
    OR position('response := jsonb_build_object' in source)=0 THEN
    RAISE EXCEPTION 'Unexpected partial receipt implementation';
  END IF;
  source := replace(source,marker,'INSERT INTO inventory_receipt_private.writes VALUES
    (txid_current(),p_purchase_id,auth.uid(),false); ' || marker);
  source := replace(source,'SET location_id=p_location_id,stock_receipt_location_id=p_location_id',
    'SET stock_receipt_location_id=p_location_id');
  source := replace(source,'response := jsonb_build_object','DELETE FROM inventory_receipt_private.writes
    WHERE transaction_id=txid_current() AND purchase_id=p_purchase_id; response := jsonb_build_object');
  EXECUTE source;

  source := pg_get_functiondef('public.apply_inventory_operations_locked(uuid,uuid,jsonb)'::regprocedure);
  marker := 'UPDATE public.purchases SET stock_received=true,location_id=(';
  IF position(marker in source)=0 OR position('response := jsonb_build_object' in source)=0 THEN
    RAISE EXCEPTION 'Unexpected legacy receipt implementation';
  END IF;
  IF position('IF bill.location_id IS DISTINCT FROM target_id THEN' in source)=0 THEN
    RAISE EXCEPTION 'Unexpected legacy receipt destination check';
  END IF;
  source := replace(source,'IF bill.location_id IS DISTINCT FROM target_id THEN',
    'IF bill.stock_receipt_location_id IS DISTINCT FROM target_id THEN');
  source := replace(source,marker,'INSERT INTO inventory_receipt_private.writes
    SELECT txid_current(),id,auth.uid(),true FROM unnest(receipts) id;
    UPDATE public.purchases SET stock_received=true,stock_receipt_location_id=(');
  source := replace(source,'response := jsonb_build_object','DELETE FROM inventory_receipt_private.writes
    WHERE transaction_id=txid_current() AND purchase_id=ANY(receipts); response := jsonb_build_object');
  EXECUTE source;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_inventory_operations_locked(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.inventory_transfer_manager(p_site_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT coalesce(public.current_user_site_role(p_site_id) IN ('owner','admin'),false);
$$;
REVOKE ALL ON FUNCTION public.inventory_transfer_manager(uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
