import { notFound } from "next/navigation"
import { getShopSite } from "../../actions"
import { getStorefrontPromotionDetail } from "@/app/promotions/storefront-promotions"
import {
  isPromotionCurrentlyRunnable,
  isPromotionEligibleForStorefront,
} from "@/app/promotions/promotion-availability"
import { PromoBundleExperience } from "@/app/components/commerce/PromoBundleExperience"
import { SiteLocaleBootstrap } from "@/app/components/commerce/SiteLocaleBootstrap"
import { ShopSlugNotFound } from "../../ShopSlugNotFound"

export const dynamic = "force-dynamic"

export default async function ShopPromoPage({
  params,
}: {
  params: Promise<{ siteSlug: string; promotionId: string }>
}) {
  const { siteSlug, promotionId } = await params
  const site = await getShopSite(siteSlug)
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

  return (
    <>
      <SiteLocaleBootstrap locale={site.settings?.default_locale} />
      <PromoBundleExperience
        promo={res.data as any}
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
