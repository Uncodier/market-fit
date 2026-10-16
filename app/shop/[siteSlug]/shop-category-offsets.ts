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

const FALLBACK_PAGE_SIZE = 1000

function applyShopCatalogOrder<
  T extends { order: (column: string, options: { ascending: boolean }) => T }
>(query: T): T {
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
  const names: string[] = []
  let offset = 0

  while (true) {
    const { data: rows, error, count } = await applyShopCatalogOrder(
      applyStorefrontAvailability(
        supabase
          .from("catalog_items")
          .select("id, category:catalog_categories(name)", { count: "exact" })
          .eq("site_id", siteId)
          .eq("status", "active")
          .eq("is_marketplace_listed", true)
          .is("parent_id", null)
      )
    ).range(offset, offset + FALLBACK_PAGE_SIZE - 1)

    // Reject inside unstable_cache so failed or incomplete counts are never cached.
    if (error || !rows || typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
      throw new Error("Unable to load shop category offsets")
    }

    for (const row of rows as { category: unknown }[]) {
      names.push(categoryNameFromJoin(row.category) || SHOP_UNCATEGORIZED_NAME)
    }

    // A server row limit may be smaller than our page size. Advance by the rows
    // actually returned and use the exact total, not a short page, to stop.
    offset += rows.length
    if (offset >= count) break
    if (rows.length === 0) {
      throw new Error("Incomplete shop category offsets")
    }
  }

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
    ["shop-category-offsets-v9", siteId],
    {
      revalidate: SHOP_CACHE_REVALIDATE_SECONDS,
      tags: [shopCacheTag(siteId)],
    }
  )()
}