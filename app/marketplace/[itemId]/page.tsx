import { getPdpCatalogItem } from "@/app/commerce/pdp-actions"
import { notFound } from "next/navigation"
import { ProductDetailPage } from "@/app/components/commerce/pdp/ProductDetailPage"
import { Metadata } from "next"

export async function generateMetadata({ params }: { params: Promise<{ itemId: string }> }): Promise<Metadata> {
  const { itemId } = await params
  const item = await getPdpCatalogItem(itemId, { requireMarketplace: true })
  
  if (!item) return { title: 'Marketplace Item | Makinari' }
  
  const siteName = (item as any).site?.name || 'Marketplace'
  return { title: `${item.name} | ${siteName}` }
}

export default async function MarketplaceItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  
  const item = await getPdpCatalogItem(itemId, { requireMarketplace: true })
  
  if (!item) {
    notFound()
  }

  return <ProductDetailPage item={item as any} backUrl="/marketplace" />
}