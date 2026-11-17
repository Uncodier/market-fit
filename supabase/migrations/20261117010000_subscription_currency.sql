BEGIN;

-- Null preserves the existing plan-currency fallback until a subscription is edited.
ALTER TABLE public.subscriptions ADD COLUMN currency text
  CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');

COMMENT ON COLUMN public.subscriptions.currency IS
  'Currency override for newly issued subscription invoices; does not convert amounts or rewrite history.';

-- Keep renewal writers consistent, including Workflows outside this repository.
-- Invoker rights retain the caller's RLS and same-site visibility requirements.
CREATE FUNCTION public.apply_subscription_invoice_currency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  subscription_currency text;
BEGIN
  IF NEW.subscription_id IS NOT NULL THEN
    SELECT s.currency INTO subscription_currency
    FROM public.subscriptions AS s
    WHERE s.id = NEW.subscription_id AND s.site_id = NEW.site_id;
    IF subscription_currency IS NOT NULL THEN
      NEW.currency := subscription_currency;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER apply_subscription_invoice_currency
BEFORE INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.apply_subscription_invoice_currency();

COMMIT;