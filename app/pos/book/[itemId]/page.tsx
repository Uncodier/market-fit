"use client"

import { use } from "react"
import { getCatalogItem } from "@/app/catalog/actions"
import useSWR from "swr"
import { BookingExperience } from "@/app/components/commerce/booking/BookingExperience"
import { useRouter } from "next/navigation"

export default function PosBookingPage(props: { params: Promise<{ itemId: string }> }) {
  const params = use(props.params)
  const router = useRouter()
  
  const { data: itemData, isLoading } = useSWR(
    ['catalog-item', params.itemId],
    () => getCatalogItem(params.itemId)
  )
  
  const item = itemData?.data

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/20">Loading...</div>
  }

  if (!item) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/20">Item not found</div>
  }

  const handleSelect = (startIso: string, endIso: string) => {
    // Store selected slot in session storage so POS can pick it up
    sessionStorage.setItem('pos-pending-reservation', JSON.stringify({
      itemId: item.id,
      startIso,
      endIso
    }))
    router.push(`/pos`)
  }

  return (
    <BookingExperience
      mode="pos"
      item={item}
      backUrl={`/pos`}
      onCartAdd={handleSelect}
    />
  )
}
