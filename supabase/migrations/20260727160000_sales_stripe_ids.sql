-- Add Stripe linkage columns to sales table
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Create partial unique indexes for fast reverse lookup from Stripe webhooks
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_stripe_checkout_session 
  ON public.sales(stripe_checkout_session_id) 
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_stripe_payment_intent 
  ON public.sales(stripe_payment_intent_id) 
  WHERE stripe_payment_intent_id IS NOT NULL;
