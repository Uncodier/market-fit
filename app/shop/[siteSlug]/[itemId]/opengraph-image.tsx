import { getPdpCatalogItem } from "@/app/commerce/pdp-actions"
import {
  resolveCatalogItemShareImageSource,
  respondWithShareImageSource,
} from "@/app/lib/commerce-metadata"

export const alt = "Product"
export const size = { width: 1200, height: 630 }
export const contentType = "image/jpeg"

export default async function Image({
  params,
}: {
  params: Promise<{ siteSlug: string; itemId: string }>
}) {
  const { itemId } = await params
  const item = await getPdpCatalogItem(itemId)
  const source = item
    ? resolveCatalogItemShareImageSource(item as any)
    : { kind: "url" as const, url: "/opengraph-image.jpg" }

  return respondWithShareImageSource(source)
}
