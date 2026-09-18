BEGIN;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS stripe_checkout_attempt bigint NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS sales_stripe_checkout_session_id_uidx
  ON public.sales (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.stripe_amount_to_minor(
  p_amount numeric,
  p_currency text
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_currency text := lower(trim(coalesce(p_currency, '')));
  v_minor numeric;
BEGIN
  IF p_amount IS NULL OR p_amount < 0 OR v_currency = '' THEN
    RETURN NULL;
  END IF;

  IF v_currency = 'ugx' THEN
    IF p_amount <> trunc(p_amount) THEN
      RETURN NULL;
    END IF;
    v_minor := p_amount * 100;
  ELSIF v_currency = ANY (ARRAY[
    'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
    'pyg', 'rwf', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'
  ]) THEN
    v_minor := round(p_amount);
  ELSE
    v_minor := round(p_amount * 100);
  END IF;

  IF v_minor > 9223372036854775807 THEN
    RETURN NULL;
  END IF;
  RETURN v_minor::bigint;
END;
$$;

REVOKE ALL ON FUNCTION public.stripe_amount_to_minor(numeric, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_stripe_checkout_attempt(
  p_sale_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_expected_session_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_currency text;
  v_expected_minor bigint;
  v_attempt bigint;
BEGIN
  IF p_amount_minor IS NULL OR p_amount_minor < 0 THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'Invalid payment amount'
    );
  END IF;

  SELECT *
  INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'Payment record not found'
    );
  END IF;

  IF v_sale.status NOT IN ('pending', 'completed') THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'This payment is no longer available'
    );
  END IF;

  IF v_sale.amount_due IS NULL OR v_sale.amount_due <= 0 THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'This document has no outstanding balance'
    );
  END IF;

  v_currency := lower(trim(coalesce(v_sale.currency, 'USD')));
  IF v_currency <> lower(trim(coalesce(p_currency, ''))) THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'Payment currency changed'
    );
  END IF;

  v_expected_minor :=
    public.stripe_amount_to_minor(v_sale.amount_due, v_currency);
  IF v_expected_minor IS NULL OR v_expected_minor <> p_amount_minor THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'Payment amount changed'
    );
  END IF;

  IF v_sale.stripe_checkout_session_id
    IS DISTINCT FROM p_expected_session_id THEN
    RETURN jsonb_build_object(
      'status', 'checkout_changed',
      'session_id', v_sale.stripe_checkout_session_id
    );
  END IF;

  v_attempt := coalesce(v_sale.stripe_checkout_attempt, 0) + 1;
  UPDATE public.sales
  SET stripe_checkout_attempt = v_attempt,
      stripe_checkout_session_id = NULL,
      updated_at = now()
  WHERE id = v_sale.id;

  RETURN jsonb_build_object(
    'status', 'reserved',
    'attempt', v_attempt
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.link_stripe_checkout_session(
  p_sale_id uuid,
  p_attempt bigint,
  p_session_id text,
  p_amount_minor bigint,
  p_currency text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_currency text;
  v_expected_minor bigint;
BEGIN
  IF p_attempt IS NULL
    OR nullif(trim(p_session_id), '') IS NULL
    OR p_amount_minor IS NULL
    OR p_amount_minor < 0 THEN
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'invalid_input');
  END IF;

  SELECT *
  INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'sale_not_found');
  END IF;
  IF v_sale.stripe_checkout_attempt <> p_attempt THEN
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'stale_attempt');
  END IF;
  IF v_sale.status NOT IN ('pending', 'completed')
    OR v_sale.amount_due IS NULL
    OR v_sale.amount_due <= 0 THEN
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'not_payable');
  END IF;

  v_currency := lower(trim(coalesce(v_sale.currency, 'USD')));
  v_expected_minor :=
    public.stripe_amount_to_minor(v_sale.amount_due, v_currency);
  IF v_currency <> lower(trim(coalesce(p_currency, '')))
    OR v_expected_minor IS NULL
    OR v_expected_minor <> p_amount_minor THEN
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'payment_changed');
  END IF;

  UPDATE public.sales
  SET stripe_checkout_session_id = p_session_id,
      updated_at = now()
  WHERE id = v_sale.id;

  RETURN jsonb_build_object('status', 'linked');
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_stripe_sale_checkout(
  p_sale_id uuid,
  p_order_id uuid,
  p_session_id text,
  p_amount_minor bigint,
  p_currency text,
  p_payment_intent_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_order public.sale_orders%ROWTYPE;
  v_currency text;
  v_expected_minor bigint;
  v_paid_amount numeric;
  v_payment jsonb;
  v_payments jsonb;
  v_payment_details jsonb;
  v_order_status text;
BEGIN
  IF nullif(trim(p_session_id), '') IS NULL
    OR p_amount_minor IS NULL
    OR p_amount_minor <= 0 THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'invalid_session_payment'
    );
  END IF;

  SELECT *
  INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'sale_not_found'
    );
  END IF;
  IF v_sale.status IN ('cancelled', 'refunded')
    OR v_sale.status NOT IN ('pending', 'completed') THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'sale_not_payable'
    );
  END IF;
  IF v_sale.stripe_checkout_session_id IS DISTINCT FROM p_session_id THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'checkout_session_replaced'
    );
  END IF;

  v_currency := lower(trim(coalesce(v_sale.currency, 'USD')));
  IF v_currency <> lower(trim(coalesce(p_currency, ''))) THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'currency_mismatch'
    );
  END IF;

  IF v_sale.amount_due IS NULL OR v_sale.amount_due <= 0 THEN
    RETURN jsonb_build_object(
      'status', 'already_settled',
      'reason', 'no_outstanding_balance'
    );
  END IF;

  v_expected_minor :=
    public.stripe_amount_to_minor(v_sale.amount_due, v_currency);
  IF v_expected_minor IS NULL OR v_expected_minor <> p_amount_minor THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'amount_mismatch'
    );
  END IF;

  IF p_order_id IS NULL AND EXISTS (
    SELECT 1
    FROM public.sale_orders
    WHERE sale_id = v_sale.id
  ) THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'sale_order_required'
    );
  END IF;

  IF p_order_id IS NOT NULL THEN
    SELECT *
    INTO v_order
    FROM public.sale_orders
    WHERE id = p_order_id
      AND sale_id = v_sale.id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'status', 'rejected',
        'reason', 'sale_order_not_found'
      );
    END IF;
    IF v_order.status IN ('cancelled', 'refunded')
      OR v_order.status NOT IN ('pending', 'completed') THEN
      RETURN jsonb_build_object(
        'status', 'rejected',
        'reason', 'sale_order_not_payable'
      );
    END IF;
  END IF;

  v_paid_amount := v_sale.amount_due;
  v_payment := jsonb_build_object(
    'method', 'stripe',
    'amount', v_paid_amount,
    'tendered', v_paid_amount,
    'change', 0,
    'date', now(),
    'status', 'completed',
    'stripe_session_id', p_session_id
  );
  IF p_payment_intent_id IS NOT NULL THEN
    v_payment := v_payment || jsonb_build_object(
      'stripe_payment_intent_id', p_payment_intent_id
    );
  END IF;

  v_payments := CASE
    WHEN jsonb_typeof(v_sale.payments) = 'array' THEN v_sale.payments
    ELSE '[]'::jsonb
  END;
  v_payment_details := CASE
    WHEN jsonb_typeof(v_sale.payment_details) = 'object'
      THEN v_sale.payment_details
    ELSE '{}'::jsonb
  END;
  v_payment_details := v_payment_details || jsonb_build_object(
    'processor', 'stripe',
    'stripe_checkout_session_id', p_session_id,
    'amount_total', p_amount_minor,
    'currency', v_currency
  );
  IF p_payment_intent_id IS NOT NULL THEN
    v_payment_details := v_payment_details || jsonb_build_object(
      'stripe_payment_intent_id', p_payment_intent_id
    );
  END IF;

  UPDATE public.sales
  SET status = 'completed',
      amount_due = 0,
      payment_method = 'stripe',
      stripe_checkout_session_id = p_session_id,
      stripe_payment_intent_id = p_payment_intent_id,
      payment_details = v_payment_details,
      payments = v_payments || jsonb_build_array(v_payment),
      updated_at = now()
  WHERE id = v_sale.id;

  IF p_order_id IS NOT NULL THEN
    v_order_status := CASE
      WHEN v_order.fulfillment_method = 'none' THEN 'completed'
      ELSE 'in_progress'
    END;
    UPDATE public.sale_orders
    SET status = v_order_status,
        updated_at = now()
    WHERE id = v_order.id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'settled',
    'sale_id', v_sale.id,
    'site_id', v_sale.site_id,
    'lead_id', v_sale.lead_id,
    'order_id', p_order_id,
    'order_user_id', CASE WHEN p_order_id IS NULL THEN NULL ELSE v_order.user_id END,
    'order_buyer_user_id',
      CASE WHEN p_order_id IS NULL THEN NULL ELSE v_order.buyer_user_id END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_stripe_checkout_attempt(
  uuid, bigint, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_stripe_checkout_session(
  uuid, bigint, text, bigint, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_stripe_sale_checkout(
  uuid, uuid, text, bigint, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stripe_checkout_attempt(
  uuid, bigint, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.link_stripe_checkout_session(
  uuid, bigint, text, bigint, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_stripe_sale_checkout(
  uuid, uuid, text, bigint, text, text
) TO service_role;

COMMIT;
