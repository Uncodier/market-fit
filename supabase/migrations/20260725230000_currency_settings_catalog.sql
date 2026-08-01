-- Migration to add currency to settings, catalog_items, and sale_orders

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

ALTER TABLE public.sale_orders
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
