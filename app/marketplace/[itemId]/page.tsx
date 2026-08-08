import { getPdpCatalogItem } from "@/app/commerce/pdp-actions"
import { notFound } from "next/navigation"
import { ProductDetailPage } from "@/app/components/commerce/pdp/ProductDetailPage"
import { Metadata } from "next"
import { buildCatalogItemShareMetadata } from "@/app/lib/commerce-metadata"

export async function generateMetadata({ params }: { params: Promise<{ itemId: string }> }): Promise<Metadata> {
  const { itemId } = await params
  const item = await getPdpCatalogItem(itemId, { requireMarketplace: true })
  
  if (!item) return { title: 'Marketplace Item | Makinari' }

  return buildCatalogItemShareMetadata(item as any, `/marketplace/${itemId}`)
}

export default async function MarketplaceItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  
  const item = await getPdpCatalogItem(itemId, { requireMarketplace: true })
  
  if (!item) {
    notFound()
  }

  return <ProductDetailPage item={item as any} backUrl="/marketplace" />
}