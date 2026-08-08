import { Suspense } from "react"
import { createServiceClient } from "@/lib/supabase/server"
import { MarketplaceClient } from "./MarketplaceClient"
import { attachSiteSettings } from "./attach-site-settings"
import { getBuyerGeoApprox } from "@/app/commerce/buyer-geo"
import { buildShareMetadata } from "@/app/lib/commerce-metadata"

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

  const { data: catalogItems, count, error } = await supabase
    .from('catalog_items')
    .select('*, site:sites!inner(id, name, logo_url)', { count: 'exact' })
    .eq('is_marketplace_listed', true)
    .eq('status', 'active')
    .eq('availability_status', 'available')
    .is('parent_id', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[marketplace] Failed to load products:', error.message)
  }

  const itemsWithSettings = await attachSiteSettings(supabase, catalogItems || [])
  const initialTotalPages = count ? Math.ceil(count / 20) : 0;
  const buyerGeo = await getBuyerGeoApprox();

  return (
    <Suspense fallback={<div className="flex-1 min-h-screen bg-muted/30" />}>
      <MarketplaceClient 
        initialItems={itemsWithSettings} 
        initialCount={count || 0}
        initialTotalPages={initialTotalPages}
        buyerGeo={buyerGeo}
      />
    </Suspense>
  )
}
