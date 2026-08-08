import { getShopSite } from "./actions"
import { resolveShopShareVisual } from "@/app/lib/commerce-metadata"
import { OG_SIZE, renderCommerceOgImage } from "@/app/lib/commerce-og"

export const runtime = "nodejs"
export const alt = "Shop"
export const size = OG_SIZE
export const contentType = "image/png"

export default async function Image({
  params,
}: {
  params: Promise<{ siteSlug: string }>
}) {
  const { siteSlug } = await params
  const site = await getShopSite(siteSlug)

  if (!site) {
    return renderCommerceOgImage({
      source: { kind: "url", url: "/images/logo.png" },
      fit: "contain",
    })
  }

  const visual = resolveShopShareVisual(site)
  return renderCommerceOgImage({
    source: visual.source,
    fit: visual.fit,
  })
}
