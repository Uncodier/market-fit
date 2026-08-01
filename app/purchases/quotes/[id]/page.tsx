"use client"

import React from "react"
import { BuyerQuoteDetailView } from "@/app/buyer/components/BuyerQuoteDetailView"
import { useSite } from "@/app/context/SiteContext"

export default function CompanyQuotationDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params)
  const { currentSite } = useSite()
  
  if (!currentSite) return null
  
  return (
    <BuyerQuoteDetailView 
      quoteId={resolvedParams.id}
      backHref="/purchases/quotes"
      returnUrl="/purchases/orders"
      defaultOwnerSiteId={currentSite.id}
      lockDestination={true}
    />
  )
}
