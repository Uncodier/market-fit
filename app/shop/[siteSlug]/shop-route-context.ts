import { cache } from "react"
import { resolveSelfServiceLocation } from "@/app/commerce/self-service"
import { getShopSite } from "./actions"

/** A location UUID takes precedence over the legacy site UUID/slug lookup. */
export const getShopRouteContext = cache(async (identifier: string) => {
  const selfService = await resolveSelfServiceLocation(identifier)
  if (selfService) return { site: selfService.site, selfService }
  const site = await getShopSite(identifier)
  return site ? { site, selfService: null } : null
})

export type ShopSelfServiceContext = NonNullable<
  Awaited<ReturnType<typeof resolveSelfServiceLocation>>
>