-- Migration: Add fulfillment data to sale_orders

ALTER TABLE public.sale_orders
  ADD COLUMN IF NOT EXISTS fulfillment_method text CHECK (fulfillment_method = ANY (ARRAY['pickup'::text, 'ship'::text, 'dine_in'::text, 'none'::text])),
  ADD COLUMN IF NOT EXISTS origin_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipping_address jsonb;
