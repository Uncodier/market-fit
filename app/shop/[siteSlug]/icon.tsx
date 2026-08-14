import { getShopSite } from "./actions"
import { resolveShopIconVisual } from "@/app/lib/commerce-metadata"
import { ICON_SIZE, renderCommerceIcon } from "@/app/lib/commerce-og"

export const runtime = "nodejs"
export const size = ICON_SIZE
export const contentType = "image/png"

export default async function Icon({
  params,
}: {
  params: Promise<{ siteSlug: string }>
}) {
  const { siteSlug } = await params
  const site = await getShopSite(siteSlug)
  if (!site) {
    return renderCommerceIcon({ kind: "url", url: "/images/logo.png" }, ICON_SIZE, {
      fit: "contain",
    })
  }

  const visual = resolveShopIconVisual(site)
  return renderCommerceIcon(visual.source, ICON_SIZE, { fit: visual.fit })
}
