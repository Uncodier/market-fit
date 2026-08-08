-- Migration to add sort_order to catalog categories and items

ALTER TABLE public.catalog_categories ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.catalog_items ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_catalog_categories_site_sort_order ON public.catalog_categories(site_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_catalog_items_site_sort_order ON public.catalog_items(site_id, sort_order);

-- Backfill categories sort_order using name alphabetically per site
WITH ordered_categories AS (
  SELECT id, row_number() OVER (PARTITION BY site_id ORDER BY name ASC) as new_order
  FROM public.catalog_categories
)
UPDATE public.catalog_categories
SET sort_order = ordered_categories.new_order
FROM ordered_categories
WHERE public.catalog_categories.id = ordered_categories.id;

-- Backfill items sort_order using created_at asc per site
WITH ordered_items AS (
  SELECT id, row_number() OVER (PARTITION BY site_id ORDER BY created_at ASC) as new_order
  FROM public.catalog_items
  WHERE parent_id IS NULL
)
UPDATE public.catalog_items
SET sort_order = ordered_items.new_order
FROM ordered_items
WHERE public.catalog_items.id = ordered_items.id;
