CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS sale_orders_site_order_number_trgm_idx
  ON public.sale_orders
  USING gin (order_number extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS sale_order_items_site_name_trgm_idx
  ON public.sale_order_items
  USING gin (name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS sale_order_item_units_site_created_idx
  ON public.sale_order_item_units (
    site_id,
    created_at DESC,
    sale_order_item_id,
    unit_index
  );
