import { redirect } from "next/navigation"
import { getShopRouteContext } from "../../shop-route-context"
import ShopBookingClient from "./ShopBookingClient"

export default async function ShopBookingPage(props: {
  params: Promise<{ siteSlug: string; itemId: string }>
  searchParams: Promise<{ modifiers?: string }>
}) {
  const { siteSlug } = await props.params
  const context = await getShopRouteContext(siteSlug)
  // Booking never escapes into an authenticated/buy-now checkout from a kiosk.
  if (context?.selfService) redirect(`/shop/${siteSlug}`)
  return <ShopBookingClient {...props} />
}