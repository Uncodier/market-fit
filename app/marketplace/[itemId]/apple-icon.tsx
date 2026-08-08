import { getPdpCatalogItem } from "@/app/commerce/pdp-actions"
import { resolveCatalogItemShareImageSource } from "@/app/lib/commerce-metadata"
import { APPLE_ICON_SIZE, renderCommerceIcon } from "@/app/lib/commerce-og"

export const runtime = "nodejs"
export const size = APPLE_ICON_SIZE
export const contentType = "image/png"

export default async function AppleIcon({
  params,
}: {
  params: Promise<{ itemId: string }>
}) {
  const { itemId } = await params
  const item = await getPdpCatalogItem(itemId, { requireMarketplace: true })
  const source = item
    ? resolveCatalogItemShareImageSource(item as any)
    : { kind: "url" as const, url: "/images/logo.png" }

  return renderCommerceIcon(source, APPLE_ICON_SIZE)
}
