import { getShopSite } from "./actions"
import {
  resolveShopShareImageSource,
  respondWithShareImageSource,
} from "@/app/lib/commerce-metadata"

export const alt = "Shop"
export const size = { width: 1200, height: 630 }
export const contentType = "image/jpeg"

export default async function Image({
  params,
}: {
  params: Promise<{ siteSlug: string }>
}) {
  const { siteSlug } = await params
  const site = await getShopSite(siteSlug)
  if (!site) {
    return respondWithShareImageSource({
      kind: "url",
      url: "/opengraph-image.jpg",
    })
  }

  return respondWithShareImageSource(resolveShopShareImageSource(site))
}
