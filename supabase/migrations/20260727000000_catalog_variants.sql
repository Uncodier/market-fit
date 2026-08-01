-- Migration: Add variants support to catalog_items
-- Adds parent_id for child variants (SKUs) and is_purchasable flag.

ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_purchasable boolean DEFAULT true;

-- Parent items (which define variant axes) should typically have is_purchasable = false,
-- while the child items (which define option values) have is_purchasable = true.
-- Simple items without variants have parent_id = NULL and is_purchasable = true.

CREATE INDEX IF NOT EXISTS idx_catalog_items_parent_id ON public.catalog_items (site_id, parent_id);
