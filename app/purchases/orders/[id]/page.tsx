"use client"

import React from "react"
import { BuyerOrderDetailView } from "@/app/buyer/components/BuyerOrderDetailView"

export default function PurchasesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params)
  
  return <BuyerOrderDetailView orderId={resolvedParams.id} backHref="/purchases/orders" />
}
