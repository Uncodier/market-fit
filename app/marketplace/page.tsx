import { Suspense } from "react"
import { MarketplaceClient } from "./MarketplaceClient"
import { buildShareMetadata } from "@/app/lib/commerce-metadata"
import { loadMarketplaceHome, MARKETPLACE_REVALIDATE_SECONDS } from "./load-marketplace-home"

export const revalidate = 60

export const metadata = buildShareMetadata({
  title: "Marketplace | Makinari",
  description: "Discover and purchase products, services, and digital assets across Makinari shops.",
  imageUrl: "/opengraph-image.jpg",
  url: "/marketplace",
  siteName: "Makinari",
})

export default async function MarketplacePage() {
  const { items, count, initialTotalPages, merchandising } = await loadMarketplaceHome()

  return (
    <Suspense fallback={<div className="flex-1 min-h-screen bg-muted/30" />}>
      <MarketplaceClient
        initialItems={items}
        initialCount={count}
        initialTotalPages={initialTotalPages}
        discountsFeed={merchandising.discountsFeed}
        promoBadgesByItemId={merchandising.byItemId}
      />
    </Suspense>
  )
}
