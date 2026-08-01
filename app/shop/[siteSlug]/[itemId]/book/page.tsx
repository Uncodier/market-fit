"use client"

import { use } from "react"
import { getCatalogItem } from "@/app/catalog/actions"
import { getShopSite } from "../../actions"
import useSWR from "swr"
import { BookingExperience } from "@/app/components/commerce/booking/BookingExperience"
import { usePdpCart } from "@/app/components/commerce/pdp/usePdpCart"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { ExitDemoMode } from "@/app/components/commerce/ExitDemoMode"

export default function ShopBookingPage(props: { params: Promise<{ siteSlug: string; itemId: string }> }) {
  const params = use(props.params)
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

  if (siteLoading || itemLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/20">Loading...</div>
  }

  if (!site || !item) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/20">Item not found</div>
  }

  const handleCartAdd = (startIso: string, endIso: string) => {
    addToCartStorage(item, 1, startIso, endIso)
    toast.success(`${item.name} added to cart`)
    router.push(`/shop/${params.siteSlug}?cart=1`)
  }

  return (
    <>
      <ExitDemoMode />
      <BookingExperience
        mode="cart"
        item={item}
        backUrl={`/shop/${params.siteSlug}/${item.id}`}
        onCartAdd={handleCartAdd}
      />
    </>
  )
}
