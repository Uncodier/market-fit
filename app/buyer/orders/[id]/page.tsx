"use client"

import React from "react"
import { BuyerOrderDetailView } from "../../components/BuyerOrderDetailView"

export default function BuyerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params)
  
  return <BuyerOrderDetailView orderId={resolvedParams.id} backHref="/buyer/orders" />
}
