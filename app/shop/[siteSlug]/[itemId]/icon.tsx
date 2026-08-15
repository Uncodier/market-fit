import { getPdpCatalogItem } from "@/app/commerce/pdp-actions"
import { resolveCatalogItemShareImageSource } from "@/app/lib/commerce-metadata"
import { ICON_SIZE, renderCommerceIcon } from "@/app/lib/commerce-og"

export const runtime = "nodejs"
export const size = ICON_SIZE
export const contentType = "image/png"

export default async function Icon({
  params,
}: {
  params: Promise<{ siteSlug: string; itemId: string }>
}) {
  try {
    const { itemId } = await params
    const item = await getPdpCatalogItem(itemId)
    const source = item
      ? resolveCatalogItemShareImageSource(item as any)
      : { kind: "url" as const, url: "/images/logo.png" }

    return await renderCommerceIcon(source, ICON_SIZE)
  } catch (error) {
    console.error(`Error generating icon for product:`, error)
    return renderCommerceIcon({ kind: "url", url: "/images/logo.png" }, ICON_SIZE)
  }
}
