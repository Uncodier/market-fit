import { getEntitlementById } from "@/app/buyer/entitlement-queries"
import { getPdpCatalogItem } from "@/app/commerce/pdp-actions"
import { resolveCatalogItemShareImageSource } from "@/app/lib/commerce-metadata"
import { OG_SIZE, renderCommerceOgImage } from "@/app/lib/commerce-og"

export const runtime = "nodejs"
export const alt = "Book Service"
export const size = OG_SIZE
export const contentType = "image/png"

export default async function Image({
  params,
}: {
  params: Promise<{ entitlementId: string }>
}) {
  const { entitlementId } = await params
  const entitlement = await getEntitlementById(entitlementId)
  
  let item = null
  if (entitlement?.catalog_item_id) {
    item = await getPdpCatalogItem(entitlement.catalog_item_id, { siteId: entitlement.site_id }) || entitlement.catalog_item
  }

  if (!item) {
    return renderCommerceOgImage({
      source: { kind: "url", url: "/images/logo.png" },
      fit: "contain",
    })
  }

  return renderCommerceOgImage({
    source: resolveCatalogItemShareImageSource(item as any),
    fit: item.image_url || item.metadata?.gallery?.[0] ? "cover" : "contain",
    title: `Book ${item.name}`,
    subtitle: "Schedule your pass/service",
    eyebrow: "Booking",
  })
}
