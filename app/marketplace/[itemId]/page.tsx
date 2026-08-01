import { getPdpCatalogItem } from "@/app/commerce/pdp-actions"
import { notFound } from "next/navigation"
import { ProductDetailPage } from "@/app/components/commerce/pdp/ProductDetailPage"

export const metadata = {
  title: 'Marketplace Item | Makinri',
}

export default async function MarketplaceItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  
  const item = await getPdpCatalogItem(itemId, { requireMarketplace: true })
  
  if (!item) {
    notFound()
  }

  return <ProductDetailPage item={item as any} backUrl="/marketplace" />
}