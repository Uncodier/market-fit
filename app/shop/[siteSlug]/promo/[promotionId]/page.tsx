import { notFound } from "next/navigation"
import { getShopRouteContext } from "../../shop-route-context"
import { getStorefrontPromotionDetail } from "@/app/promotions/storefront-promotions"
import {
  isPromotionCurrentlyRunnable,
  isPromotionEligibleForStorefront,
} from "@/app/promotions/promotion-availability"
import { PromoBundleExperience } from "@/app/components/commerce/PromoBundleExperience"
import type { PromoBundleData } from "@/app/components/commerce/PromoBundleExperience"
import { SiteLocaleBootstrap } from "@/app/components/commerce/SiteLocaleBootstrap"
import { ShopSlugNotFound } from "../../ShopSlugNotFound"
import { SelfServicePromotion } from "../../self-service/SelfServicePromotion"
import { getPdpCatalogItem } from "@/app/commerce/pdp-actions"
import { loadSelfServiceModifierOptions } from "@/app/commerce/self-service-modifier-options"
import { isSelfServiceItem } from "@/app/commerce/self-service-options"
import { enrichSelfServiceInventory } from "../../self-service-catalog"
import { selfServicePromotionItems } from "../../self-service/self-service-promotion-requirements"

export const dynamic = "force-dynamic"

export default async function ShopPromoPage({
  params,
}: {
  params: Promise<{ siteSlug: string; promotionId: string }>
}) {
  const { siteSlug, promotionId } = await params
  const context = await getShopRouteContext(siteSlug)
  const site = context?.site
  if (!site) return <ShopSlugNotFound slug={siteSlug} />

  const res = await getStorefrontPromotionDetail({
    promotionId,
    siteId: site.id,
  })
  if ("error" in res || !res.data) notFound()

  const timezone = site?.settings?.business_hours?.[0]?.timezone || null
  const eligible = isPromotionEligibleForStorefront({
    promo: res.data,
    surface: "shop",
  })
  if (!eligible) notFound()

  const availableNow = isPromotionCurrentlyRunnable({
    promo: res.data,
    timezone,
  })

  if (context?.selfService) {
    const { location, fulfillmentOptions } = context.selfService
    const promo = res.data as PromoBundleData
    const unique = selfServicePromotionItems(promo)
    const resolved = await Promise.all(unique.map(async (row) => {
      const item = await getPdpCatalogItem(row.id, { requireStorefront: true })
      if (!item || item.site_id !== site.id || !isSelfServiceItem(item, fulfillmentOptions, location.id)) return null
      const groups = await loadSelfServiceModifierOptions({ locationId: location.id, hostId: item.id, fulfillment: fulfillmentOptions[0] })
      const [branchItem] = await enrichSelfServiceInventory(site.id, location.id, [item])
      return { item: branchItem, minimum: row.minimum, configurable: !!groups.error || groups.data.length > 0 }
    }))
    return <>
      <SiteLocaleBootstrap locale={site.settings?.default_locale} />
      <SelfServicePromotion promo={promo} items={resolved.filter((row): row is NonNullable<typeof row> => !!row)} availableNow={availableNow} />
    </>
  }

  return (
    <>
      <SiteLocaleBootstrap locale={site.settings?.default_locale} />
      <PromoBundleExperience
        promo={res.data as PromoBundleData}
        surface="shop"
        siteSlug={siteSlug}
        backHref={`/shop/${siteSlug}`}
        site={{
          id: site.id,
          name: site.name,
          logo_url: site.logo_url,
        }}
        siteCurrency={site.settings?.currency || null}
        availableNow={availableNow}
      />
    </>
  )
}
