-- Serialize quotation checkout and give retries stable sale/order identities.

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS checkout_claim_id uuid,
  ADD COLUMN IF NOT EXISTS checkout_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkout_sale_id uuid,
  ADD COLUMN IF NOT EXISTS checkout_order_id uuid;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS quotation_id uuid;

ALTER TABLE public.sale_orders
  ADD COLUMN IF NOT EXISTS quotation_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quotations_checkout_sale_id_fkey'
      AND conrelid = 'public.quotations'::regclass
  ) THEN
    ALTER TABLE public.quotations
      ADD CONSTRAINT quotations_checkout_sale_id_fkey
      FOREIGN KEY (checkout_sale_id)
      REFERENCES public.sales(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quotations_checkout_order_id_fkey'
      AND conrelid = 'public.quotations'::regclass
  ) THEN
    ALTER TABLE public.quotations
      ADD CONSTRAINT quotations_checkout_order_id_fkey
      FOREIGN KEY (checkout_order_id)
      REFERENCES public.sale_orders(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_quotation_id_fkey'
      AND conrelid = 'public.sales'::regclass
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_quotation_id_fkey
      FOREIGN KEY (quotation_id)
      REFERENCES public.quotations(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_orders_quotation_id_fkey'
      AND conrelid = 'public.sale_orders'::regclass
  ) THEN
    ALTER TABLE public.sale_orders
      ADD CONSTRAINT sale_orders_quotation_id_fkey
      FOREIGN KEY (quotation_id)
      REFERENCES public.quotations(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS quotations_checkout_claimed_at_idx
  ON public.quotations (checkout_claimed_at)
  WHERE checkout_claim_id IS NOT NULL;

-- Preserve the legacy accepted quote relationship where it is unambiguous.
WITH candidates AS (
  SELECT DISTINCT ON (deal.accepted_quotation_id)
    sale.id AS sale_id,
    deal.accepted_quotation_id AS quotation_id
  FROM public.deals AS deal
  JOIN public.sales AS sale
    ON sale.id = deal.sales_order_id
  WHERE deal.accepted_quotation_id IS NOT NULL
  ORDER BY deal.accepted_quotation_id, sale.created_at, sale.id
)
UPDATE public.sales AS sale
SET quotation_id = candidates.quotation_id
FROM candidates
WHERE candidates.sale_id = sale.id
  AND sale.quotation_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.sales AS other_sale
    WHERE other_sale.quotation_id = candidates.quotation_id
  );

WITH candidates AS (
  SELECT DISTINCT ON (sale.quotation_id)
    sale_order.id AS order_id,
    sale.quotation_id
  FROM public.sales AS sale
  JOIN public.sale_orders AS sale_order
    ON sale_order.sale_id = sale.id
  WHERE sale.quotation_id IS NOT NULL
  ORDER BY sale.quotation_id, sale_order.created_at, sale_order.id
)
UPDATE public.sale_orders AS sale_order
SET quotation_id = candidates.quotation_id
FROM candidates
WHERE candidates.order_id = sale_order.id
  AND sale_order.quotation_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.sale_orders AS other_order
    WHERE other_order.quotation_id = candidates.quotation_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS sales_quotation_id_unique
  ON public.sales (quotation_id)
  WHERE quotation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sale_orders_quotation_id_unique
  ON public.sale_orders (quotation_id)
  WHERE quotation_id IS NOT NULL;

UPDATE public.quotations AS quotation
SET
  checkout_sale_id = sale.id,
  checkout_order_id = sale_order.id
FROM public.sales AS sale
LEFT JOIN public.sale_orders AS sale_order
  ON sale_order.quotation_id = sale.quotation_id
WHERE quotation.id = sale.quotation_id
  AND quotation.status = 'accepted'
  AND quotation.checkout_sale_id IS NULL;

CREATE OR REPLACE FUNCTION public.claim_quotation_checkout(
  p_quotation_id uuid,
  p_site_id uuid,
  p_claim_id uuid,
  p_buyer_user_id uuid,
  p_public_access_token text
)
RETURNS TABLE (
  result text,
  sale_id uuid,
  order_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  quotation_row public.quotations%ROWTYPE;
  token_authorized boolean;
  buyer_authorized boolean;
BEGIN
  IF p_claim_id IS NULL THEN
    RETURN QUERY SELECT 'unauthorized'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT *
  INTO quotation_row
  FROM public.quotations
  WHERE id = p_quotation_id
  FOR UPDATE;

  IF NOT FOUND OR quotation_row.site_id <> p_site_id THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  token_authorized :=
    p_public_access_token IS NOT NULL
    AND p_public_access_token ~ '^[A-Za-z0-9_-]{20,64}$'
    AND quotation_row.public_access_token = p_public_access_token
    AND quotation_row.public_access_token_revoked_at IS NULL
    AND (
      quotation_row.public_access_token_expires_at IS NULL
      OR quotation_row.public_access_token_expires_at > now()
    );

  buyer_authorized :=
    p_public_access_token IS NULL
    AND p_buyer_user_id IS NOT NULL
    AND quotation_row.buyer_user_id IS NOT NULL
    AND quotation_row.buyer_user_id = p_buyer_user_id;

  IF NOT token_authorized AND NOT buyer_authorized THEN
    RETURN QUERY SELECT 'unauthorized'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF quotation_row.status = 'accepted'
     AND quotation_row.checkout_sale_id IS NOT NULL
     AND quotation_row.checkout_order_id IS NOT NULL THEN
    RETURN QUERY
      SELECT
        'completed'::text,
        quotation_row.checkout_sale_id,
        quotation_row.checkout_order_id;
    RETURN;
  END IF;

  IF quotation_row.status <> 'sent' THEN
    RETURN QUERY SELECT 'unavailable'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF quotation_row.valid_until IS NOT NULL
     AND quotation_row.valid_until < now() THEN
    RETURN QUERY SELECT 'expired'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF quotation_row.checkout_claim_id IS NULL
     OR quotation_row.checkout_claim_id = p_claim_id
     OR quotation_row.checkout_claimed_at IS NULL
     OR quotation_row.checkout_claimed_at < now() - interval '10 minutes' THEN
    UPDATE public.quotations
    SET
      checkout_claim_id = p_claim_id,
      checkout_claimed_at = now()
    WHERE id = p_quotation_id;

    RETURN QUERY
      SELECT
        'claimed'::text,
        quotation_row.checkout_sale_id,
        quotation_row.checkout_order_id;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      'busy'::text,
      quotation_row.checkout_sale_id,
      quotation_row.checkout_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_quotation_checkout(
  p_quotation_id uuid,
  p_claim_id uuid,
  p_sale_id uuid,
  p_order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  quotation_row public.quotations%ROWTYPE;
BEGIN
  SELECT *
  INTO quotation_row
  FROM public.quotations
  WHERE id = p_quotation_id
  FOR UPDATE;

  IF NOT FOUND
     OR p_claim_id IS NULL
     OR quotation_row.status <> 'sent'
     OR quotation_row.checkout_claim_id IS DISTINCT FROM p_claim_id THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sales
    WHERE id = p_sale_id
      AND quotation_id = p_quotation_id
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.sale_orders
    WHERE id = p_order_id
      AND sale_id = p_sale_id
      AND quotation_id = p_quotation_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.quotations
  SET
    status = 'accepted',
    checkout_sale_id = p_sale_id,
    checkout_order_id = p_order_id,
    checkout_claim_id = NULL,
    checkout_claimed_at = NULL
  WHERE id = p_quotation_id;

  IF quotation_row.deal_id IS NOT NULL THEN
    UPDATE public.deals
    SET
      stage = 'closed_won',
      status = 'won',
      accepted_quotation_id = p_quotation_id,
      amount = quotation_row.total,
      sales_order_id = p_sale_id
    WHERE id = quotation_row.deal_id;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_quotation_checkout_claim(
  p_quotation_id uuid,
  p_claim_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH released AS (
    UPDATE public.quotations
    SET
      checkout_claim_id = NULL,
      checkout_claimed_at = NULL
    WHERE id = p_quotation_id
      AND status = 'sent'
      AND checkout_claim_id = p_claim_id
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM released);
$$;

REVOKE ALL ON FUNCTION public.claim_quotation_checkout(uuid, uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_quotation_checkout(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_quotation_checkout_claim(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_quotation_checkout(uuid, uuid, uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_quotation_checkout(uuid, uuid, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_quotation_checkout_claim(uuid, uuid)
  TO service_role;
