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

export default function ShopBookingPage(props: { params: Promise<{ siteSlug: string; itemId: string }>; searchParams: Promise<{ modifiers?: string }> | { modifiers?: string } }) {
  const params = use(props.params as any) as { siteSlug: string; itemId: string };
  const searchParams = use(props.searchParams as any) as { modifiers?: string };
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
      document.title = `Book ${item.name} | ${site.name}`
    }
  }, [item, site])

  if (siteLoading || itemLoading) {
    return <BookLoading />
  }

  if (!site) {
    return <ShopSlugNotFound slug={params.siteSlug} />
  }

  if (!item) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/20">Item not found</div>
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
    toast.success(`${item.name} added to cart`)
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
