-- Migration: Add status and metadata to sale_order_items

ALTER TABLE public.sale_order_items
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status = ANY (ARRAY['draft', 'new', 'preparing', 'completed'])),
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_sale_order_items_order_status
  ON public.sale_order_items (sale_order_id, status);
