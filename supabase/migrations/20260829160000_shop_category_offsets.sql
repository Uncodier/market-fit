-- Category chip offsets for shop home without loading every listed parent row.
-- Matches getShopCatalog order: sort_order, name, id (ASC, Postgres default NULLS LAST).
-- Availability matches STOREFRONT_AVAILABILITY_OR.

CREATE OR REPLACE FUNCTION public.shop_category_offsets(p_site_id uuid)
RETURNS TABLE(name text, "offset" integer, count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  WITH listed AS (
    SELECT
      COALESCE(NULLIF(BTRIM(cc.name), ''), 'Other') AS category_name,
      (ROW_NUMBER() OVER (
        ORDER BY ci.sort_order ASC NULLS LAST, ci.name ASC NULLS LAST, ci.id ASC
      ) - 1)::integer AS row_offset
    FROM public.catalog_items ci
    LEFT JOIN public.catalog_categories cc ON cc.id = ci.category_id
    WHERE ci.site_id = p_site_id
      AND ci.status = 'active'
      AND ci.is_marketplace_listed = true
      AND ci.parent_id IS NULL
      AND (
        ci.availability_mode IS NULL
        OR ci.availability_mode <> 'manual'
        OR ci.availability_status = 'available'
      )
  )
  SELECT
    category_name AS name,
    MIN(row_offset) AS "offset",
    COUNT(*)::integer AS count
  FROM listed
  GROUP BY category_name
  ORDER BY MIN(row_offset);
$$;

REVOKE ALL ON FUNCTION public.shop_category_offsets(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_category_offsets(uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.shop_category_offsets(uuid) IS
  'Shop category chip offsets (first index + count) for listed parent items.';
