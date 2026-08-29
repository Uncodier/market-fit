import { unstable_cache } from "next/cache"
import { createServiceClient } from "@/lib/supabase/server"
import { applyStorefrontAvailability } from "@/app/catalog/storefront-availability"
import {
  buildShopCategoryOffsets,
  mapShopCategoryOffsetRows,
  SHOP_CACHE_REVALIDATE_SECONDS,
  SHOP_UNCATEGORIZED_NAME,
  shopCacheTag,
  type ShopCategoryOffset,
} from "./shop-catalog-shared"

function applyShopCatalogOrder<T extends { order: (...args: any[]) => T }>(query: T): T {
  return query
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .order("id", { ascending: true })
}

function categoryNameFromJoin(category: unknown): string | null {
  const cat = Array.isArray(category) ? category[0] : category
  return (cat as { name?: string | null } | null)?.name || null
}

async function loadShopCategoryOffsetsFallback(
  siteId: string,
  supabase: Awaited<ReturnType<typeof createServiceClient>>
): Promise<ShopCategoryOffset[]> {
  const { data: rows, error } = await applyShopCatalogOrder(
    applyStorefrontAvailability(
      supabase
        .from("catalog_items")
        .select("id, category:catalog_categories(name)")
        .eq("site_id", siteId)
        .eq("status", "active")
        .eq("is_marketplace_listed", true)
        .is("parent_id", null)
    )
  )

  if (error || !rows) return []

  const names = rows.map(
    (row) => categoryNameFromJoin((row as any).category) || SHOP_UNCATEGORIZED_NAME
  )
  return buildShopCategoryOffsets(names)
}

export async function getShopCategoryOffsets(siteId: string): Promise<ShopCategoryOffset[]> {
  return unstable_cache(
    async () => {
      const supabase = await createServiceClient(true)
      const { data, error } = await supabase.rpc("shop_category_offsets", {
        p_site_id: siteId,
      })
      if (!error && Array.isArray(data)) {
        return mapShopCategoryOffsetRows(data)
      }
      return loadShopCategoryOffsetsFallback(siteId, supabase)
    },
    ["shop-category-offsets-v8", siteId],
    {
      revalidate: SHOP_CACHE_REVALIDATE_SECONDS,
      tags: [shopCacheTag(siteId)],
    }
  )()
}