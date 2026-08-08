-- Migration to add shipping_cost to sale_orders

ALTER TABLE public.sale_orders
  ADD COLUMN IF NOT EXISTS shipping_cost numeric NOT NULL DEFAULT 0;
