"use client"

import React from "react"
import { ProcurementQuotationDetail } from '../quotation-detail'
import { QuotationDetailSkeleton } from '../quotation-detail-skeleton'
import { useSite } from "@/app/context/SiteContext"

export default function CompanyQuotationDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params)
  const { currentSite } = useSite()
  
  if (!currentSite) return <QuotationDetailSkeleton />
  
  return (
    <ProcurementQuotationDetail id={resolvedParams.id} siteId={currentSite.id} />
  )
}
