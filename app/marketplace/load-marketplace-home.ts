import { unstable_cache } from "next/cache"
import { getMarketplaceMerchandising } from "@/app/promotions/storefront-promotions"
import { loadMarketplaceProducts } from "./load-marketplace-products"
import { MARKETPLACE_PAGE_SIZE } from "./marketplace-pagination"
import { applyBuyerPricesToItems } from "@/app/price-lists/buyer-prices"

export const MARKETPLACE_REVALIDATE_SECONDS = 60
export const MARKETPLACE_CACHE_TAG = "marketplace-home"

export async function loadMarketplaceHome() {
  const home = await unstable_cache(
    async () => {
      const [products, merchandising] = await Promise.all([
        loadMarketplaceProducts({}, true),
        getMarketplaceMerchandising({}),
      ])
      return {
        items: products.items,
        count: products.count,
        initialTotalPages: products.totalPages,
        initialRegions: products.regions,
        merchandising,
      }
    },
    ["marketplace-home-filters-v3", String(MARKETPLACE_PAGE_SIZE)],
    { revalidate: MARKETPLACE_REVALIDATE_SECONDS, tags: [MARKETPLACE_CACHE_TAG] }
  )()
  return { ...home, items: await applyBuyerPricesToItems(home.items, "marketplace") }
}
