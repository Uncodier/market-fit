BEGIN;
SET LOCAL lock_timeout = '5s';

-- Fulfillment status is not evidence of an inventory movement. These protected
-- high-water marks are written in the SAME transaction as the inventory delta.
-- Keep tombstones after line deletion: deleting/reinserting an ID must not reset
-- its budget. Deliberately no FK to the mutable line/order records.
CREATE TABLE public.order_line_inventory_receipts (
  sale_order_item_id uuid PRIMARY KEY,
  sale_order_id uuid NOT NULL,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  catalog_item_id uuid,
  location_id uuid,
  processed_quantity numeric NOT NULL DEFAULT 0,
  debited_quantity numeric NOT NULL DEFAULT 0,
  restocked_quantity numeric NOT NULL DEFAULT 0,
  review_required boolean NOT NULL DEFAULT false,
  restock_requested boolean NOT NULL DEFAULT false,
  reconciliation_reason text,
  reconciled_at timestamptz,
  reconciled_by uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (debited_quantity >= 0 AND debited_quantity <= 1000000000),
  CHECK (processed_quantity >= debited_quantity AND processed_quantity <= 1000000000),
  CHECK (restocked_quantity >= 0 AND restocked_quantity <= debited_quantity),
  CHECK (debited_quantity = 0 OR location_id IS NOT NULL)
);
CREATE INDEX order_line_inventory_receipts_order_idx
  ON public.order_line_inventory_receipts(site_id,sale_order_id);
ALTER TABLE public.order_line_inventory_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_line_inventory_receipts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.order_line_inventory_receipts TO authenticated,service_role;
CREATE POLICY order_line_inventory_receipts_read ON public.order_line_inventory_receipts
  FOR SELECT TO authenticated USING (public.user_can(site_id,'select')
    AND location_id IS NOT NULL AND public.user_can_access_location(site_id,location_id));

-- Only genuinely new lines have a known zero budget. No historical backfill
-- guesses from payment, completed status, shipment flags, or client metadata.
CREATE FUNCTION public.seed_order_line_inventory_receipt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- Other commerce sources retain their existing inventory owner. A later source
  -- reassignment must remain ambiguous rather than inherit a false zero budget.
  IF NOT EXISTS(SELECT 1 FROM public.sale_orders o JOIN public.sales s ON s.id=o.sale_id AND s.site_id=o.site_id
    WHERE o.id=NEW.sale_order_id AND o.site_id=NEW.site_id AND s.source='pos'
      AND NOT coalesce(public.is_self_service_order_items(o.items),false)) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.order_line_inventory_receipts
    (sale_order_item_id,sale_order_id,site_id,catalog_item_id)
    VALUES(NEW.id,NEW.sale_order_id,NEW.site_id,NEW.catalog_item_id)
    ON CONFLICT (sale_order_item_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.seed_order_line_inventory_receipt() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER seed_order_line_inventory_receipt AFTER INSERT ON public.sale_order_items
  FOR EACH ROW EXECUTE FUNCTION public.seed_order_line_inventory_receipt();

CREATE FUNCTION public.reconcile_order_line_inventory(
  p_site_id uuid,p_order_id uuid,p_line_id uuid,p_location_id uuid,
  p_target_quantity numeric,p_mode text DEFAULT 'debit'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE
  actor_role text := current_setting('role',true);
  doc public.sale_orders%ROWTYPE;
  line public.sale_order_items%ROWTYPE;
  receipt public.order_line_inventory_receipts%ROWTYPE;
  tracked boolean;
  policy text;
  amount numeric := 0;
  requested numeric := 0;
  current_quantity numeric;
  inventory_result jsonb;
  skipped boolean := false;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'READ COMMITTED required' USING ERRCODE='40001';
  END IF;
  IF actor_role IS NULL OR actor_role NOT IN ('authenticated','service_role')
    OR (actor_role='authenticated' AND auth.uid() IS NULL) THEN
    RAISE EXCEPTION 'Inventory access denied' USING ERRCODE='42501';
  END IF;
  IF p_site_id IS NULL OR p_order_id IS NULL OR p_line_id IS NULL OR (p_mode='debit' AND p_location_id IS NULL)
    OR p_target_quantity IS NULL OR p_target_quantity::text IN ('NaN','Infinity','-Infinity')
    OR p_target_quantity < 0 OR p_target_quantity > 1000000000
    OR p_mode IS NULL OR p_mode NOT IN ('debit','restock') THEN
    RAISE EXCEPTION 'Invalid order line inventory request' USING ERRCODE='22023';
  END IF;
  -- Match the inventory writer lock order; recheck permissions after waiting.
  PERFORM public.lock_site_license(p_site_id);
  IF actor_role='authenticated' AND NOT coalesce(public.user_can(p_site_id,'update'),false) THEN
    RAISE EXCEPTION 'Inventory access denied' USING ERRCODE='42501';
  END IF;
  SELECT * INTO doc FROM public.sale_orders WHERE id=p_order_id AND site_id=p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid inventory order' USING ERRCODE='42501'; END IF;
  SELECT * INTO line FROM public.sale_order_items
    WHERE id=p_line_id AND sale_order_id=p_order_id AND site_id=p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid inventory order line' USING ERRCODE='42501'; END IF;
  SELECT * INTO receipt FROM public.order_line_inventory_receipts WHERE sale_order_item_id=p_line_id FOR UPDATE;
  IF p_mode='restock' AND p_location_id IS NULL THEN
    p_location_id := coalesce(receipt.location_id,doc.origin_location_id);
  END IF;
  IF actor_role='authenticated' AND NOT coalesce(public.user_can_access_location(p_site_id,p_location_id),false) THEN
    RAISE EXCEPTION 'Inventory access denied' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.locations WHERE id=p_location_id AND site_id=p_site_id)
    OR (NOT coalesce(p_mode='restock' AND receipt.location_id=p_location_id,false)
      AND doc.origin_location_id IS DISTINCT FROM p_location_id AND NOT EXISTS(
      SELECT 1 FROM public.shipments WHERE id=line.shipment_id AND sale_order_id=p_order_id
        AND site_id=p_site_id AND origin_location_id=p_location_id)) THEN
    RAISE EXCEPTION 'Invalid order inventory location' USING ERRCODE='42501';
  END IF;
  IF line.quantity IS NULL OR line.quantity::text IN ('NaN','Infinity','-Infinity')
    OR line.quantity < 0 OR line.quantity > 1000000000
    OR (p_mode='debit' AND p_target_quantity > line.quantity)
    OR (line.metadata IS NOT NULL AND jsonb_typeof(line.metadata) <> 'object')
    OR (line.metadata ? 'completed_without_stock'
      AND jsonb_typeof(line.metadata->'completed_without_stock') <> 'boolean') THEN
    RAISE EXCEPTION 'Invalid inventory order line quantity or metadata' USING ERRCODE='22023';
  END IF;
  IF line.catalog_item_id IS NOT NULL THEN
    SELECT track_inventory INTO tracked FROM public.catalog_items
      WHERE id=line.catalog_item_id AND site_id=p_site_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid inventory product' USING ERRCODE='42501'; END IF;
  END IF;
  SELECT coalesce(commerce->>'decrement_stock_on','ship') INTO policy
    FROM public.settings WHERE site_id=p_site_id LIMIT 1;
  -- Self-service owns a separate atomic release receipt and is never double-debited.
  skipped := public.is_self_service_order_items(doc.items);
  INSERT INTO public.order_line_inventory_receipts
    (sale_order_item_id,sale_order_id,site_id,catalog_item_id,location_id,review_required)
    VALUES(line.id,doc.id,p_site_id,line.catalog_item_id,p_location_id,true)
    ON CONFLICT (sale_order_item_id) DO NOTHING;
  SELECT * INTO receipt FROM public.order_line_inventory_receipts WHERE sale_order_item_id=p_line_id FOR UPDATE;
  IF ROW(receipt.sale_order_id,receipt.site_id,receipt.catalog_item_id)
    IS DISTINCT FROM ROW(p_order_id,p_site_id,line.catalog_item_id)
    OR (receipt.location_id IS NOT NULL AND receipt.location_id <> p_location_id) THEN
    RAISE EXCEPTION 'Inventory receipt identity mismatch' USING ERRCODE='42501';
  END IF;
  IF p_mode='debit' THEN
    skipped := coalesce(skipped,false) OR NOT coalesce(tracked,false)
      OR coalesce(policy,'ship')='never' OR line.metadata->'completed_without_stock'='true'::jsonb;
  ELSIF receipt.debited_quantity=0 AND line.metadata->'completed_without_stock'='true'::jsonb THEN
    -- An explicit no-stock line has nothing to return. A real existing debit is
    -- still refunded even if its metadata or catalog tracking was changed later.
    skipped := true;
  END IF;
  skipped := coalesce(skipped,false);
  IF NOT receipt.review_required AND skipped AND p_mode='debit' THEN
    -- An intentional zero movement is still a processed target. Later policy,
    -- tracking, or metadata changes cannot turn its replay into a new debit.
    receipt.processed_quantity := greatest(receipt.processed_quantity,p_target_quantity);
  END IF;
  IF NOT receipt.review_required AND NOT skipped THEN
    IF p_mode='debit' THEN
      requested := greatest(0,p_target_quantity-receipt.processed_quantity);
      IF requested>0 AND (receipt.restock_requested OR doc.status='cancelled' OR line.status='cancelled') THEN
        RAISE EXCEPTION 'Cannot debit a returned or cancelled order line' USING ERRCODE='22023';
      END IF;
      IF requested>0 THEN
        -- The catalog lock above is the existing writer mutex, including missing
        -- levels. Record actual removed units, not a floor-zero phantom refund.
        SELECT quantity INTO current_quantity FROM public.inventory_levels
          WHERE site_id=p_site_id AND catalog_item_id=line.catalog_item_id AND location_id=p_location_id FOR UPDATE;
        current_quantity := coalesce(current_quantity,0);
        inventory_result := public.apply_location_inventory_delta(p_site_id,line.catalog_item_id,p_location_id,-requested,true);
        amount := greatest(0,current_quantity-(inventory_result->>'quantity')::numeric);
        receipt.processed_quantity := receipt.processed_quantity+requested;
        receipt.debited_quantity := receipt.debited_quantity+amount;
      END IF;
    ELSE
      receipt.restock_requested := true;
      amount := greatest(0,least(p_target_quantity,receipt.debited_quantity)-receipt.restocked_quantity);
      IF amount>0 THEN
        PERFORM public.apply_location_inventory_delta(p_site_id,line.catalog_item_id,p_location_id,amount,false);
        receipt.restocked_quantity := receipt.restocked_quantity+amount;
      END IF;
    END IF;
  END IF;
  UPDATE public.order_line_inventory_receipts SET location_id=p_location_id,
    processed_quantity=receipt.processed_quantity,restock_requested=receipt.restock_requested,
    debited_quantity=receipt.debited_quantity,restocked_quantity=receipt.restocked_quantity,
    updated_at=clock_timestamp() WHERE sale_order_item_id=p_line_id;
  RETURN jsonb_build_object('review_required',receipt.review_required AND NOT skipped,
    'debited_quantity',receipt.debited_quantity,'restocked_quantity',receipt.restocked_quantity,
    'applied_quantity',amount,'skipped',skipped);
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_order_line_inventory(uuid,uuid,uuid,uuid,numeric,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_order_line_inventory(uuid,uuid,uuid,uuid,numeric,text)
  TO authenticated,service_role;

-- Explicit operator attestation, NOT an inventory adjustment or inferred
-- backfill. Only an authorized server/operator may establish historical facts.
-- Reason must identify the evidence and operator when no end-user JWT is used.
CREATE FUNCTION public.resolve_order_line_inventory_review(
  p_site_id uuid,p_order_id uuid,p_line_id uuid,p_location_id uuid,
  p_processed_quantity numeric,p_actual_debited_quantity numeric,
  p_actual_restocked_quantity numeric,p_reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE receipt public.order_line_inventory_receipts%ROWTYPE;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Server inventory reconciliation required' USING ERRCODE='42501';
  END IF;
  IF p_processed_quantity IS NULL OR p_actual_debited_quantity IS NULL OR p_actual_restocked_quantity IS NULL
    OR p_processed_quantity::text IN ('NaN','Infinity','-Infinity')
    OR p_actual_debited_quantity::text IN ('NaN','Infinity','-Infinity')
    OR p_actual_restocked_quantity::text IN ('NaN','Infinity','-Infinity')
    OR p_processed_quantity<0 OR p_processed_quantity>1000000000
    OR p_actual_debited_quantity<0 OR p_actual_debited_quantity>p_processed_quantity
    OR p_actual_restocked_quantity<0 OR p_actual_restocked_quantity>p_actual_debited_quantity
    OR p_location_id IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 20 AND 2000 THEN
    RAISE EXCEPTION 'Invalid inventory reconciliation attestation' USING ERRCODE='22023';
  END IF;
  -- Reuse the same locked scope validation, review registration and lock order.
  -- Zero target cannot move inventory; known receipts cannot be overwritten.
  PERFORM public.reconcile_order_line_inventory(p_site_id,p_order_id,p_line_id,p_location_id,0,'debit');
  SELECT * INTO receipt FROM public.order_line_inventory_receipts WHERE sale_order_item_id=p_line_id FOR UPDATE;
  IF NOT receipt.review_required THEN
    RAISE EXCEPTION 'Inventory receipt is already reconciled' USING ERRCODE='22023';
  END IF;
  IF receipt.catalog_item_id IS NULL AND p_actual_debited_quantity>0 THEN
    RAISE EXCEPTION 'Inventory reconciliation requires a catalog item' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.sale_orders o JOIN public.sales s ON s.id=o.sale_id AND s.site_id=o.site_id
    WHERE o.id=p_order_id AND o.site_id=p_site_id AND s.source='pos'
      AND NOT coalesce(public.is_self_service_order_items(o.items),false)) THEN
    RAISE EXCEPTION 'POS inventory reconciliation required' USING ERRCODE='42501';
  END IF;
  UPDATE public.order_line_inventory_receipts SET processed_quantity=p_processed_quantity,
    debited_quantity=p_actual_debited_quantity,restocked_quantity=p_actual_restocked_quantity,
    restock_requested=p_actual_restocked_quantity>0,review_required=false,
    reconciliation_reason=btrim(p_reason),reconciled_at=clock_timestamp(),reconciled_by=auth.uid(),
    updated_at=clock_timestamp() WHERE sale_order_item_id=p_line_id;
  RETURN jsonb_build_object('review_required',false,'processed_quantity',p_processed_quantity,
    'debited_quantity',p_actual_debited_quantity,'restocked_quantity',p_actual_restocked_quantity);
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_order_line_inventory_review(uuid,uuid,uuid,uuid,numeric,numeric,numeric,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.resolve_order_line_inventory_review(uuid,uuid,uuid,uuid,numeric,numeric,numeric,text)
  TO service_role;
COMMIT;