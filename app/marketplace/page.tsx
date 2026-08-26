import { Suspense } from "react"
import { createServiceClient } from "@/lib/supabase/server"
import { MarketplaceClient } from "./MarketplaceClient"
import { attachSiteSettings } from "./attach-site-settings"
import { getBuyerGeoApprox } from "@/app/commerce/buyer-geo"
import { buildShareMetadata } from "@/app/lib/commerce-metadata"
import { getMarketplaceMerchandising } from "@/app/promotions/storefront-promotions"
import { applyChannelPricesToItems } from "@/app/price-lists/apply-channel-prices"
import { loadVariantListingPreviews } from "@/app/catalog/variant-resolve"
import { applyStorefrontAvailability } from "@/app/catalog/storefront-availability"

export const dynamic = "force-dynamic"

export const metadata = buildShareMetadata({
  title: "Marketplace | Makinari",
  description: "Discover and purchase products, services, and digital assets across Makinari shops.",
  imageUrl: "/opengraph-image.jpg",
  url: "/marketplace",
  siteName: "Makinari",
})

export default async function MarketplacePage() {
  // Public marketplace aggregation — same pattern as /shop (service role bypasses RLS)
  const supabase = await createServiceClient(true)

  const { data: catalogItems, count, error } = await applyStorefrontAvailability(
    supabase
      .from('catalog_items')
      .select('*, site:sites!inner(id, name, logo_url)', { count: 'exact' })
      .eq('is_marketplace_listed', true)
      .eq('status', 'active')
      .is('parent_id', null)
  )
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[marketplace] Failed to load products:', error.message)
  }

  const itemsWithSettings = await attachSiteSettings(supabase, catalogItems || [])
  const pricedItems = await applyChannelPricesToItems(
    supabase,
    itemsWithSettings,
    "marketplace"
  )
  const variantPreviews = await loadVariantListingPreviews(
    supabase,
    pricedItems.map((item) => ({ id: item.id, name: item.name }))
  )
  const itemsWithVariants = pricedItems.map((item) => {
    const preview = variantPreviews.get(item.id)
    return {
      ...item,
      _shop: {
        ...(item as any)._shop,
        hasVariants:
          Boolean(preview?.hasVariants) ||
          Boolean(item.metadata?.variant_axes?.length && item.is_purchasable === false),
        variantLabels: preview?.labels || [],
      },
    }
  })
  const initialTotalPages = count ? Math.ceil(count / 20) : 0;
  const buyerGeo = await getBuyerGeoApprox();
  const merchandising = await getMarketplaceMerchandising({})

  return (
    <Suspense fallback={<div className="flex-1 min-h-screen bg-muted/30" />}>
      <MarketplaceClient 
        initialItems={itemsWithVariants} 
        initialCount={count || 0}
        initialTotalPages={initialTotalPages}
        buyerGeo={buyerGeo}
        discountsFeed={merchandising.discountsFeed}
        promoBadgesByItemId={merchandising.byItemId}
      />
    </Suspense>
  )
}
