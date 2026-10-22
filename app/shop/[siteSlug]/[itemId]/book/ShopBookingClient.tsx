"use client"

import { use } from "react"
import { getCatalogItem } from "@/app/catalog/actions"
import { getShopSite } from "../../actions"
import useSWR from "swr"
import { BookingExperience } from "@/app/components/commerce/booking/BookingExperience"
import { usePdpCart } from "@/app/components/commerce/pdp/usePdpCart"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { ShopSlugNotFound } from "../../ShopSlugNotFound"
import BookLoading from "./loading"
import { useLocalization } from "@/app/context/LocalizationContext"

export default function ShopBookingClient(props: { params: Promise<{ siteSlug: string; itemId: string }>; searchParams: Promise<{ modifiers?: string }> | { modifiers?: string } }) {
  const { t } = useLocalization()
  const params = use(props.params);
  const searchParams = use(props.searchParams as Promise<{ modifiers?: string }>);
  const router = useRouter()

  const { data: site, isLoading: siteLoading } = useSWR(
    ["shop-site", params.siteSlug],
    () => getShopSite(params.siteSlug)
  )

  const { data: itemData, isLoading: itemLoading } = useSWR(
    site ? ["catalog-item", params.itemId] : null,
    () => getCatalogItem(params.itemId)
  )

  const item = itemData?.data
  const { addToCartStorage } = usePdpCart(site?.id || "")

  useEffect(() => {
    if (item && site) {
      document.title = t("commercePages.booking.title", { item: item.name, site: site.name })
    }
  }, [item, site, t])

  if (siteLoading || itemLoading) {
    return <BookLoading />
  }

  if (!site) {
    return <ShopSlugNotFound slug={params.siteSlug} />
  }

  if (!item) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/20">{t("commercePages.booking.itemNotFound")}</div>
  }

  const handleCartAdd = (startIso: string, endIso: string, available?: number) => {
    let parsedModifiers = undefined
    if (searchParams?.modifiers) {
      try {
        parsedModifiers = JSON.parse(decodeURIComponent(searchParams.modifiers))
      } catch (e) {
        console.error("Failed to parse modifiers", e)
      }
    }
    addToCartStorage(item, 1, startIso, endIso, parsedModifiers, available)
    toast.success(t("commercePages.booking.addedToCart", { item: item.name }))
    router.push(`/shop/${params.siteSlug}?cart=1`)
  }

  return (
    <BookingExperience
      mode="cart"
      item={item}
      backUrl={`/shop/${params.siteSlug}/${item.parent_id || item.id}`}
      onCartAdd={handleCartAdd}
    />
  )
}
