"use client"

import React from "react"
import { BuyerQuoteDetailView } from "../../components/BuyerQuoteDetailView"

export default function BuyerQuotationDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params)
  
  return <BuyerQuoteDetailView quoteId={resolvedParams.id} />
}
