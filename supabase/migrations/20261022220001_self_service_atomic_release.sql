BEGIN;
SET LOCAL lock_timeout = '5s';
-- Freeze release snapshots while seeding the ledger and installing its writer.
LOCK TABLE public.sale_orders, public.sale_order_items IN SHARE ROW EXCLUSIVE MODE;

-- Durable, per-line high-water marks include modifiers and survive payment retries.
CREATE TABLE IF NOT EXISTS public.self_service_inventory_releases (
  sale_order_item_id uuid PRIMARY KEY REFERENCES public.sale_order_items(id),
  sale_order_id uuid NOT NULL REFERENCES public.sale_orders(id),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  catalog_item_id uuid REFERENCES public.catalog_items(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  quantity numeric NOT NULL CHECK (quantity >= 0 AND quantity::text NOT IN ('NaN','Infinity','-Infinity')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.self_service_inventory_releases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.self_service_inventory_releases FROM PUBLIC,anon,authenticated,service_role;

-- Never replay historical stock deductions. Old non-atomic cash failures require
-- operator reconciliation; their success cannot be reconstructed from line state.
INSERT INTO public.self_service_inventory_releases
  (sale_order_item_id,sale_order_id,site_id,catalog_item_id,location_id,quantity)
SELECT i.id,o.id,o.site_id,i.catalog_item_id,o.origin_location_id,greatest(0,i.quantity)
FROM public.sale_order_items i JOIN public.sale_orders o ON o.id=i.sale_order_id
WHERE public.is_self_service_order_items(o.items) AND o.origin_location_id IS NOT NULL
  AND (i.sent_at IS NOT NULL OR i.status NOT IN ('draft','cancelled') OR EXISTS (
    SELECT 1 FROM public.stripe_sale_checkout_effects e WHERE e.order_id=o.id
      AND e.inventory_completed_at IS NOT NULL))
ON CONFLICT (sale_order_item_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.apply_self_service_line_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE o public.sale_orders%ROWTYPE; prior public.self_service_inventory_releases%ROWTYPE;
  delta numeric; policy text; tracked boolean;
BEGIN
  SELECT * INTO o FROM public.sale_orders WHERE id=NEW.sale_order_id FOR UPDATE;
  IF NOT public.is_self_service_order_items(o.items) THEN RETURN NEW; END IF;
  SELECT * INTO prior FROM public.self_service_inventory_releases WHERE sale_order_item_id=NEW.id FOR UPDATE;
  IF FOUND AND ROW(prior.catalog_item_id,prior.location_id,prior.site_id,prior.sale_order_id)
    IS DISTINCT FROM ROW(NEW.catalog_item_id,o.origin_location_id,NEW.site_id,NEW.sale_order_id) THEN
    RAISE EXCEPTION 'Released self-service inventory identity is immutable' USING ERRCODE='42501';
  END IF;
  IF NEW.status IN ('draft','cancelled') THEN RETURN NEW; END IF;
  IF NEW.quantity IS NULL OR NEW.quantity < 0 OR NEW.quantity::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Invalid self-service quantity' USING ERRCODE='22023';
  END IF;
  IF o.origin_location_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.locations WHERE id=o.origin_location_id AND site_id=o.site_id
  ) THEN RAISE EXCEPTION 'Self-service inventory location mismatch' USING ERRCODE='42501'; END IF;
  delta := greatest(0,NEW.quantity-coalesce(prior.quantity,0));
  SELECT coalesce(commerce->>'decrement_stock_on','ship') INTO policy FROM public.settings WHERE site_id=o.site_id LIMIT 1;
  IF NEW.catalog_item_id IS NOT NULL THEN
    SELECT track_inventory INTO tracked FROM public.catalog_items WHERE id=NEW.catalog_item_id AND site_id=o.site_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Self-service inventory item mismatch' USING ERRCODE='42501'; END IF;
  END IF;
  IF delta > 0 AND tracked AND coalesce(policy,'ship') <> 'never' THEN
    INSERT INTO public.inventory_levels AS level (site_id,catalog_item_id,location_id,quantity,updated_at)
      VALUES (o.site_id,NEW.catalog_item_id,o.origin_location_id,0,now())
    ON CONFLICT (catalog_item_id,location_id) DO UPDATE SET
      quantity=greatest(0,level.quantity-delta),updated_at=now()
      WHERE level.site_id=o.site_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Self-service inventory tenant mismatch' USING ERRCODE='42501'; END IF;
  END IF;
  INSERT INTO public.self_service_inventory_releases
    (sale_order_item_id,sale_order_id,site_id,catalog_item_id,location_id,quantity)
    VALUES (NEW.id,o.id,o.site_id,NEW.catalog_item_id,o.origin_location_id,NEW.quantity)
    ON CONFLICT (sale_order_item_id) DO UPDATE SET
      quantity=greatest(self_service_inventory_releases.quantity,excluded.quantity),updated_at=now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_self_service_release ON public.sale_order_items;
CREATE TRIGGER inventory_self_service_release AFTER INSERT OR UPDATE ON public.sale_order_items
  FOR EACH ROW EXECUTE FUNCTION public.apply_self_service_line_inventory();
REVOKE ALL ON FUNCTION public.apply_self_service_line_inventory() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.release_self_service_order(p_site_id uuid,p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE o public.sale_orders%ROWTYPE; paid boolean; result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Server self-service release required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO o FROM public.sale_orders WHERE id=p_order_id AND site_id=p_site_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_self_service_order_items(o.items) OR o.status='cancelled' THEN
    RAISE EXCEPTION 'Active self-service order required' USING ERRCODE='42501';
  END IF;
  SELECT status='completed' AND amount_due >= 0 AND amount_due <= 0.009
    INTO paid FROM public.sales WHERE id=o.sale_id AND site_id=p_site_id FOR UPDATE;
  IF paid IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Self-service release requires full payment' USING ERRCODE='42501';
  END IF;
  PERFORM id FROM public.sale_order_items WHERE sale_order_id=o.id ORDER BY catalog_item_id,id FOR UPDATE;
  -- Consistent SKU locks serialize different orders even when their line IDs and
  -- modifiers appear in opposite order. Inventory updates still use row upserts.
  PERFORM id FROM public.catalog_items WHERE site_id=o.site_id AND id IN (
    SELECT catalog_item_id FROM public.sale_order_items WHERE sale_order_id=o.id
  ) ORDER BY id FOR UPDATE;
  -- One statement and transaction release parents and modifiers with stock effects.
  UPDATE public.sale_order_items SET status='new',sent_at=coalesce(sent_at,now())
    WHERE sale_order_id=o.id AND status='draft';
  SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]') INTO result
    FROM public.sale_order_items i WHERE sale_order_id=o.id;
  RETURN jsonb_build_object('status','completed','items',result);
END;
$$;
REVOKE ALL ON FUNCTION public.release_self_service_order(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.release_self_service_order(uuid,uuid) TO service_role;

-- Install the Stripe delegation in the same transaction as the inventory trigger.

CREATE OR REPLACE FUNCTION public.apply_stripe_sale_inventory_effect(
  p_sale_id uuid,
  p_order_id uuid,
  p_session_id text,
  p_claim_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_effect public.stripe_sale_checkout_effects%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_order public.sale_orders%ROWTYPE;
  v_commerce jsonb;
  v_policy text;
  v_item record;
BEGIN
  SELECT * INTO v_effect
  FROM public.stripe_sale_checkout_effects
  WHERE stripe_session_id = p_session_id
  FOR UPDATE;
  IF NOT FOUND
    OR v_effect.sale_id IS DISTINCT FROM p_sale_id
    OR v_effect.order_id IS DISTINCT FROM p_order_id
    OR v_effect.fulfillment_status <> 'processing'
    OR v_effect.fulfillment_claim_token IS DISTINCT FROM p_claim_token THEN
    RAISE EXCEPTION 'Stripe inventory effect is not owned by this claim';
  END IF;

  SELECT * INTO v_order
  FROM public.sale_orders
  WHERE id = p_order_id
    AND sale_id = p_sale_id
  FOR UPDATE;
  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
    AND stripe_checkout_session_id = p_session_id
  FOR UPDATE;
  IF v_sale.id IS NULL OR v_order.id IS NULL THEN
    RAISE EXCEPTION 'Stripe inventory sale or order was not found';
  END IF;

  IF public.is_self_service_order_items(v_order.items) THEN
    -- The same durable per-line effect owns cash, free and Stripe releases.
    -- Even a completed Stripe inventory retry must validate current payment.
    PERFORM public.release_self_service_order(v_order.site_id,p_order_id);
    UPDATE public.stripe_sale_checkout_effects
      SET inventory_completed_at=coalesce(inventory_completed_at,now()),updated_at=now()
      WHERE stripe_session_id=p_session_id;
    RETURN jsonb_build_object('status',CASE WHEN v_effect.inventory_completed_at IS NULL
      THEN 'completed' ELSE 'already_completed' END);
  END IF;
  IF v_effect.inventory_completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status','already_completed');
  END IF;

  SELECT commerce INTO v_commerce
  FROM public.settings
  WHERE site_id = v_sale.site_id
  LIMIT 1;
  v_policy := coalesce(v_commerce->>'decrement_stock_on', 'ship');

  IF v_policy <> 'never' AND v_order.origin_location_id IS NOT NULL THEN
    FOR v_item IN
      SELECT soi.catalog_item_id, soi.quantity
      FROM public.sale_order_items soi
      JOIN public.catalog_items ci ON ci.id = soi.catalog_item_id
      WHERE soi.sale_order_id = p_order_id
        AND soi.catalog_item_id IS NOT NULL
        AND ci.track_inventory = true
    LOOP
      INSERT INTO public.inventory_levels AS current_level (
        site_id, catalog_item_id, location_id, quantity, updated_at
      )
      VALUES (
        v_sale.site_id,
        v_item.catalog_item_id,
        v_order.origin_location_id,
        0,
        now()
      )
      ON CONFLICT (catalog_item_id, location_id)
      DO UPDATE SET
        quantity = greatest(
          0,
          current_level.quantity - v_item.quantity
        ),
        updated_at = now();
    END LOOP;
  END IF;

  UPDATE public.stripe_sale_checkout_effects
  SET inventory_completed_at = now(),
      updated_at = now()
  WHERE stripe_session_id = p_session_id;
  RETURN jsonb_build_object('status', 'completed');
END;
$$;


REVOKE ALL ON FUNCTION public.apply_stripe_sale_inventory_effect(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stripe_sale_inventory_effect(uuid,uuid,text,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
