import { notFound } from "next/navigation"
import { getStorefrontPromotionDetail } from "@/app/promotions/storefront-promotions"
import {
  isPromotionCurrentlyRunnable,
  isPromotionEligibleForStorefront,
} from "@/app/promotions/promotion-availability"
import { PromoBundleExperience } from "@/app/components/commerce/PromoBundleExperience"
import { createServiceClient } from "@/lib/supabase/server"

export const revalidate = 60

export default async function MarketplacePromoPage({
  params,
}: {
  params: Promise<{ promotionId: string }>
}) {
  const { promotionId } = await params
  const res = await getStorefrontPromotionDetail({ promotionId })
  if ("error" in res || !res.data) notFound()

  const eligible = isPromotionEligibleForStorefront({
    promo: res.data,
    surface: "marketplace",
  })
  if (!eligible) notFound()

  const availableNow = isPromotionCurrentlyRunnable({
    promo: res.data,
  })

  const supabase = await createServiceClient(true)
  const [{ data: site }, { data: settings }] = await Promise.all([
    supabase
      .from("sites")
      .select("id, name, logo_url")
      .eq("id", res.data.site_id)
      .maybeSingle(),
    supabase
      .from("settings")
      .select("currency")
      .eq("site_id", res.data.site_id)
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <PromoBundleExperience
      promo={res.data as any}
      surface="marketplace"
      backHref="/marketplace"
      site={site}
      siteCurrency={settings?.currency || null}
      availableNow={availableNow}
    />
  )
}
