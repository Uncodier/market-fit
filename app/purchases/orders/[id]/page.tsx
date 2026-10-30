"use client"

import React from "react"
import { WorkspaceOrderDetailView } from "../WorkspaceOrderDetailView"
import { PurchaseOrderDetailSkeleton } from '../order-detail-skeleton'
import { useSite } from '@/app/context/SiteContext'
import { isProcurementDemo as isDemoSiteId } from '@/app/purchases/procurement/ui/is-demo'
import { DemoOrderDocument } from '@/app/purchases/procurement/commerce/demo-documents'

export default function PurchasesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params)
  const { currentSite } = useSite()
  if (!currentSite) return <PurchaseOrderDetailSkeleton />
  if (isDemoSiteId(currentSite.id)) return <DemoOrderDocument id={resolvedParams.id} siteId={currentSite.id} />
  
  return <WorkspaceOrderDetailView orderId={resolvedParams.id} />
}
