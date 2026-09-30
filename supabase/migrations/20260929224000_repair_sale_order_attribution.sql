-- Forward-only recovery for 20260917220000_sale_order_attribution.
-- A retry may encounter existing guards before reaching the historical backfill.
-- Keep their removal and restoration atomic; never relax runtime immutability.
BEGIN;

SET LOCAL lock_timeout = '5s';
LOCK TABLE public.sale_orders IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public.sale_orders
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_by_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sale_orders.created_by_user_id IS
  'Authenticated actor who originally created the order. Immutable after creation.';
COMMENT ON COLUMN public.sale_orders.seller_user_id IS
  'Site employee credited with handling the order. Independent from workflow assignment.';
COMMENT ON COLUMN public.sale_orders.requested_by_lead_id IS
  'Lead or customer who requested the order.';

DROP TRIGGER IF EXISTS preserve_sale_order_creator ON public.sale_orders;
DROP TRIGGER IF EXISTS validate_sale_order_attribution ON public.sale_orders;

-- Historical POS cashiers may no longer be active members. As in the original
-- migration, backfill before installing runtime validation. Preserve known
-- attribution, exclude storefront ownership, and never follow cross-site links.
UPDATE public.sale_orders AS orders
SET
  created_by_user_id = COALESCE(orders.created_by_user_id, orders.user_id),
  seller_user_id = COALESCE(orders.seller_user_id, orders.user_id)
FROM public.sales AS sales
WHERE sales.id = orders.sale_id
  AND sales.site_id = orders.site_id
  AND sales.source = 'pos'
  AND orders.user_id IS NOT NULL
  AND (orders.created_by_user_id IS NULL OR orders.seller_user_id IS NULL);

UPDATE public.sale_orders AS orders
SET requested_by_lead_id = sales.lead_id
FROM public.sales AS sales
JOIN public.leads AS leads ON leads.id = sales.lead_id AND leads.site_id = sales.site_id
WHERE sales.id = orders.sale_id
  AND sales.site_id = orders.site_id
  AND orders.requested_by_lead_id IS NULL;

CREATE INDEX IF NOT EXISTS sale_orders_site_created_by_idx
  ON public.sale_orders (site_id, created_by_user_id)
  WHERE created_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sale_orders_site_seller_idx
  ON public.sale_orders (site_id, seller_user_id)
  WHERE seller_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sale_orders_site_requested_by_idx
  ON public.sale_orders (site_id, requested_by_lead_id)
  WHERE requested_by_lead_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.preserve_sale_order_creator()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.created_by_user_id IS DISTINCT FROM NEW.created_by_user_id THEN
    RAISE EXCEPTION 'created_by_user_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER preserve_sale_order_creator
BEFORE UPDATE OF created_by_user_id ON public.sale_orders
FOR EACH ROW
EXECUTE FUNCTION public.preserve_sale_order_creator();

CREATE OR REPLACE FUNCTION public.validate_sale_order_attribution()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.seller_user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.sites
      WHERE id = NEW.site_id
        AND user_id = NEW.seller_user_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.site_members
      WHERE site_id = NEW.site_id
        AND user_id = NEW.seller_user_id
        AND status = 'active'
    )
  THEN
    RAISE EXCEPTION 'seller_user_id must be an active member of the order site';
  END IF;

  IF NEW.requested_by_lead_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.leads
      WHERE id = NEW.requested_by_lead_id
        AND site_id = NEW.site_id
    )
  THEN
    RAISE EXCEPTION 'requested_by_lead_id must belong to the order site';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_sale_order_attribution
BEFORE INSERT OR UPDATE OF seller_user_id, requested_by_lead_id
ON public.sale_orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_sale_order_attribution();

COMMIT;