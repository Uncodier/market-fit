"use client"

import { StickyHeader } from "@/app/components/ui/sticky-header"
import { QuotationInvoice } from "./QuotationInvoice"
import { TenderQuotationBadge } from "./TenderQuotationBadge"

/** Shares the quotation document without exposing sales mutations or private files. */
export function TenderQuotationDetail({ quotation }: {
  quotation: Parameters<typeof QuotationInvoice>[0]["quotation"]
}) {
  return <div className="flex-1 flex flex-col bg-muted/30">
    <StickyHeader><div className="flex items-center gap-3 h-[50px]">
      <TenderQuotationBadge href={quotation.tender_url} />
      <span className="text-sm">{quotation.reference}</span>
    </div></StickyHeader>
    <div className="px-4 md:px-16 py-8 bg-muted/50 dark:bg-background min-h-screen">
      <div className="max-w-4xl mx-auto"><QuotationInvoice quotation={quotation} /></div>
    </div>
  </div>
}