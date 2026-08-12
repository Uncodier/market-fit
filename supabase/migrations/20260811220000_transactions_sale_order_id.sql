-- Link promotion (and other order-tied) expenses to sale_orders for idempotent upserts
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS sale_order_id uuid REFERENCES public.sale_orders(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_sale_order_id_unique
  ON public.transactions (sale_order_id)
  WHERE sale_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_sale_order_id
  ON public.transactions (sale_order_id)
  WHERE sale_order_id IS NOT NULL;
