"use server"

import { z } from "zod"
import { getPdpCatalogItem } from "./pdp-actions"

/** Booking uses the same uncached buyer overlay as the product page. */
export async function getStorefrontItem(input: { id: string; channel: "shop" | "marketplace"; siteId?: string }) {
  const params = z.object({ id: z.string().uuid(), channel: z.enum(["shop", "marketplace"]),
    siteId: z.string().uuid().optional() }).parse(input)
  return getPdpCatalogItem(params.id, { siteId: params.siteId,
    requireMarketplace: params.channel === "marketplace", requireStorefront: true })
}