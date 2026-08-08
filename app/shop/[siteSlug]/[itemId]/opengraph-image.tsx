import { getPdpCatalogItem } from "@/app/commerce/pdp-actions"
import { resolveCatalogItemShareImageSource } from "@/app/lib/commerce-metadata"
import { OG_SIZE, renderCommerceOgImage } from "@/app/lib/commerce-og"

export const runtime = "nodejs"
export const alt = "Product"
export const size = OG_SIZE
export const contentType = "image/png"

export default async function Image({
  params,
}: {
  params: Promise<{ siteSlug: string; itemId: string }>
}) {
  const { itemId } = await params
  const item = await getPdpCatalogItem(itemId)

  if (!item) {
    return renderCommerceOgImage({
      source: { kind: "url", url: "/images/logo.png" },
      fit: "contain",
    })
  }

  return renderCommerceOgImage({
    source: resolveCatalogItemShareImageSource(item as any),
    fit: item.image_url || item.metadata?.gallery?.[0] ? "cover" : "contain",
  })
}
