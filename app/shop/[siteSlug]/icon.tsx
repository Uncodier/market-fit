import { getShopSite } from "./actions"
import { resolveShopShareVisual } from "@/app/lib/commerce-metadata"
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
  const source = site
    ? resolveShopShareVisual(site).source
    : { kind: "url" as const, url: "/images/logo.png" }

  return renderCommerceIcon(source, ICON_SIZE)
}
