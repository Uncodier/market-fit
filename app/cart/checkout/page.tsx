import { Suspense } from "react"
import CheckoutClient from "./CheckoutClient"
import { getBuyerGeoApprox } from "@/app/commerce/buyer-geo"
import { StorefrontBuyerBoundary } from "@/app/components/commerce/StorefrontBuyerBoundary"

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const buyerGeo = await getBuyerGeoApprox()
  return (
    <Suspense fallback={<div className="min-h-screen bg-muted/30" />}>
      <StorefrontBuyerBoundary><CheckoutClient buyerGeo={buyerGeo} /></StorefrontBuyerBoundary>
    </Suspense>
  )
}
