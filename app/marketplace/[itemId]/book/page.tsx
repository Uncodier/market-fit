"use client"

import { use } from "react"
import { getCatalogItem } from "@/app/catalog/actions"
import useSWR from "swr"
import { BookingExperience } from "@/app/components/commerce/booking/BookingExperience"
import { usePdpCart } from "@/app/components/commerce/pdp/usePdpCart"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { ExitDemoMode } from "@/app/components/commerce/ExitDemoMode"
import { useEffect } from "react"

export default function MarketplaceBookingPage(props: { params: Promise<{ itemId: string }> }) {
  const params = use(props.params)
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
      const siteName = (item as any).site?.name || "Marketplace"
      document.title = `Book ${item.name} | ${siteName}`
    }
  }, [item])

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/20">Loading...</div>
  }

  if (!item) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/20">Item not found</div>
  }

  const handleCartAdd = (startIso: string, endIso: string) => {
    addToCartStorage(item, 1, startIso, endIso)
    toast.success(`${item.name} added to cart`)
    router.push(`/marketplace?cart=1`)
  }

  return (
    <>
      <ExitDemoMode />
      <BookingExperience
        mode="cart"
        item={item}
        backUrl={`/marketplace/${item.id}`}
        onCartAdd={handleCartAdd}
      />
    </>
  )
}
