'use client'

import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { QuotationInvoice } from '@/app/quotations/components/QuotationInvoice'
import { OrderDocument } from '@/app/purchases/orders/OrderDocument'
import { PurchaseOrderDetailShell } from '@/app/purchases/orders/PurchaseOrderDetailShell'
import { demoProcurementQuotes, demoOrderDocument } from '@/lib/demo-data/procurement-commerce'
import { ProcurementDemoNotice } from '../ui/demo-notice'
import { SharedEvidence } from '../evidence/shared-evidence'
import { CommerceApproval } from './CommerceApproval'

export function DemoQuotationDocument({ id, siteId }: { id: string; siteId: string }) {
  const quote = demoProcurementQuotes.find(item => item.id === id)
  return <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
    <ProcurementDemoNotice />
    <Button variant="outline" asChild><Link href="/purchases/quotes">Back to quotations</Link></Button>
    {!quote ? <p role="alert">Demo quotation not found.</p> : <>
      <QuotationInvoice quotation={{
        id: quote.id, reference: quote.reference, status: quote.award_id ? 'accepted' : 'sent',
        created_at: quote.recorded_at, valid_until: '2026-12-31T18:00:00Z', currency: quote.currency,
        site: { name: quote.supplier_name }, lead: { name: 'Demo workplace team', company: 'Demo workspace' },
        subtotal: quote.net_amount_minor / 100, tax_total: (quote.tax_amount_minor ?? 0) / 100,
        total: (quote.net_amount_minor + (quote.tax_amount_minor ?? 0)) / 100,
        notes: 'Fictional proposal. Delivery within 10 business days. Net 30 terms. No payment or supplier notification.',
        items: quote.lines.map(line => ({ id: line.id, name: line.name, description: line.name, quantity: line.quantity,
          unit_price: line.unit_net_minor / 100, subtotal: line.net_amount_minor / 100, total: line.net_amount_minor / 100 })),
      }} />
      <Button variant="link" asChild><Link href={`/purchases/tenders/${quote.tender_id}`}>{quote.tender_title}</Link></Button>
      <SharedEvidence siteId={siteId} quotationId={id} />
      <CommerceApproval siteId={siteId} targetId={quote.award_id ?? id} version={1} event={quote.award_id ? 'order' : 'award'} onChange={() => {}} />
    </>}
  </main>
}

export function DemoOrderDocument({ id, siteId }: { id: string; siteId: string }) {
  const order = demoOrderDocument(siteId, id)
  return <PurchaseOrderDetailShell order={order} notice={<ProcurementDemoNotice />} relatedQuotationHref="/purchases/quotes/demo-quote-cedar">
    {order ?
      <OrderDocument order={order} buyerName="Demo workplace team" />
      : <p role="alert">Demo order not found.</p>}
  </PurchaseOrderDetailShell>
}