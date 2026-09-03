import { unstable_cache } from "next/cache"
import { createServiceClient } from "@/lib/supabase/server"
import { attachSiteSettings } from "./attach-site-settings"
import { getMarketplaceMerchandising } from "@/app/promotions/storefront-promotions"
import { applyChannelPricesToItems } from "@/app/price-lists/apply-channel-prices"
import { loadVariantListingPreviews } from "@/app/catalog/variant-resolve"
import { applyStorefrontAvailability } from "@/app/catalog/storefront-availability"
import { loadStorefrontDisplay } from "@/app/commerce/storefront-display"

export const MARKETPLACE_REVALIDATE_SECONDS = 60
export const MARKETPLACE_CACHE_TAG = "marketplace-home"

export async function loadMarketplaceHome() {
  return unstable_cache(
    async () => {
      const supabase = await createServiceClient(true)

      const { data: catalogItems, count, error } = await applyStorefrontAvailability(
        supabase
          .from("catalog_items")
          .select("*, site:sites!inner(id, name, logo_url)", { count: "exact" })
          .eq("is_marketplace_listed", true)
          .eq("status", "active")
          .is("parent_id", null)
      )
        .order("created_at", { ascending: false })
        .limit(20)

      if (error) {
        console.error("[marketplace] Failed to load products:", error.message)
      }

      const itemsWithSettings = await attachSiteSettings(supabase, catalogItems || [])
      const pricedItems = await applyChannelPricesToItems(
        supabase,
        itemsWithSettings,
        "marketplace"
      )
      const [variantPreviews, displayMap, inventoryRes] = await Promise.all([
        loadVariantListingPreviews(
          supabase,
          pricedItems.map((item) => ({ id: item.id, name: item.name }))
        ),
        loadStorefrontDisplay(supabase, pricedItems),
        supabase.from("inventory_levels").select("catalog_item_id, quantity, site_id").in("catalog_item_id", pricedItems.map(i => i.id))
      ])

      const inventoryMap = new Map<string, number>();
      for (const level of inventoryRes.data || []) {
        inventoryMap.set(
          level.catalog_item_id,
          (inventoryMap.get(level.catalog_item_id) || 0) + Number(level.quantity)
        );
      }

      const items = pricedItems.map((item) => {
        const preview = variantPreviews.get(item.id)
        const displayData = displayMap.get(item.id)
        
        let sellable = true;
        let availableQty: number | undefined;
        const policy = (item as any).site?.settings?.commerce?.stock_shortage_policy || "allow";

        if (item.availability_mode === "manual") {
          sellable = item.availability_status === "available";
        } else if (item.availability_mode === "inventory") {
          availableQty = inventoryMap.get(item.id) || 0;
          sellable = availableQty > 0 || policy !== "block";
        }

        const hasVariants = Boolean(preview?.hasVariants) ||
          Boolean(item.metadata?.variant_axes?.length && item.is_purchasable === false);

        if (item.is_purchasable === false && !hasVariants) {
          sellable = false;
        }

        return {
          ...item,
          _shop: {
            ...(item as any)._shop,
            hasVariants,
            variantLabels: preview?.labels || [],
            sellable,
            availableQty,
            ...(displayData || {})
          },
        }
      })

      const merchandising = await getMarketplaceMerchandising({})

      return {
        items,
        count: count || 0,
        initialTotalPages: count ? Math.ceil(count / 20) : 0,
        merchandising,
      }
    },
    ["marketplace-home"],
    { revalidate: MARKETPLACE_REVALIDATE_SECONDS, tags: [MARKETPLACE_CACHE_TAG] }
  )()
}
