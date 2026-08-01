-- Migration: Add shipment_id to sale_order_items

ALTER TABLE public.sale_order_items
  ADD COLUMN IF NOT EXISTS shipment_id uuid
    REFERENCES public.shipments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sale_order_items_shipment_id
  ON public.sale_order_items (shipment_id);
