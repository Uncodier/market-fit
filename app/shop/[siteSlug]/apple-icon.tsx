import { getShopSite } from "./actions"
import { resolveShopIconVisual } from "@/app/lib/commerce-metadata"
import { APPLE_ICON_SIZE, renderCommerceIcon } from "@/app/lib/commerce-og"

export const runtime = "nodejs"
export const size = APPLE_ICON_SIZE
export const contentType = "image/png"

export default async function AppleIcon({
  params,
}: {
  params: Promise<{ siteSlug: string }>
}) {
  const { siteSlug } = await params
  const site = await getShopSite(siteSlug)
  if (!site) {
    return renderCommerceIcon(
      { kind: "url", url: "/images/logo.png" },
      APPLE_ICON_SIZE,
      { fit: "contain" },
    )
  }

  const visual = resolveShopIconVisual(site)
  return renderCommerceIcon(visual.source, APPLE_ICON_SIZE, { fit: visual.fit })
}
