"use client"

import { useEffect, useState } from 'react'
import { getDemoWorkspaceQuotation } from '../demo-workspace-quotations'
import { QuotationInvoice } from './QuotationInvoice'
import { Skeleton } from '@/app/components/ui/skeleton'

export function DemoWorkspaceQuotationDetail({ siteId, id }: { siteId: string; id: string }) {
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof getDemoWorkspaceQuotation>>>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let obsolete = false
    void getDemoWorkspaceQuotation(siteId, id).then(data => {
      if (!obsolete) { setQuote(data); setLoading(false) }
    })
    return () => { obsolete = true }
  }, [siteId, id])
  if (loading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>
  return <div className="p-4 md:p-6">
    {quote ? <QuotationInvoice quotation={quote} /> : <p>Quotation not found.</p>}
  </div>
}