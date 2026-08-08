-- Migration: Add scheduled_for to sale_orders

ALTER TABLE public.sale_orders
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz NULL;
