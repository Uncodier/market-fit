"use client"

import { use } from "react"
import { getCatalogItem } from "@/app/catalog/actions"
import useSWR from "swr"
import { BookingExperience } from "@/app/components/commerce/booking/BookingExperience"
import { usePdpCart } from "@/app/components/commerce/pdp/usePdpCart"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"

export default function MarketplaceBookingPage(props: { params: Promise<{ itemId: string }>; searchParams: Promise<{ modifiers?: string }> | { modifiers?: string } }) {
  const { t } = useLocalization()
  const params = use(props.params)
  const searchParams = use(props.searchParams as Promise<{ modifiers?: string }>);
  const router = useRouter()
  
  const { data: itemData, isLoading } = useSWR(
    ['catalog-item', params.itemId],
    () => getCatalogItem(params.itemId)
  )
  
  const item = itemData?.data
  // Provide marketplace "site_id" which is handled dynamically or we can just pass empty string.
  // Actually, usePdpCart will handle marketplace items correctly if siteId is empty or matches.
  const { addToCartStorage } = usePdpCart(item?.site_id || "")

  useEffect(() => {
    if (item) {
      // In marketplace booking, we might not have the site name loaded with the item,
      // fallback to Marketplace if not available on the item.
      const siteName = (item as { site?: { name?: string } }).site?.name || t("commercePages.booking.marketplace")
      document.title = t("commercePages.booking.title", { item: item.name, site: siteName })
    }
  }, [item, t])

  if (isLoading) {
    return <main className="min-h-screen flex items-center justify-center bg-muted/20">{t("commercePages.booking.loading")}</main>
  }

  if (!item) {
    return <main className="min-h-screen flex items-center justify-center bg-muted/20">{t("commercePages.booking.itemNotFound")}</main>
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
    router.push(`/marketplace?cart=1`)
  }

  return (
    <BookingExperience
      mode="cart"
      item={item}
      backUrl={`/marketplace/${item.parent_id || item.id}`}
      onCartAdd={handleCartAdd}
    />
  )
}
