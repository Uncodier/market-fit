'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { ChevronLeft, Printer, RotateCcw } from '@/app/components/ui/icons'
import { StickyHeader } from '@/app/components/ui/sticky-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { useLocalization } from '@/app/context/LocalizationContext'
import { OrderStatusBar } from '@/app/orders/components/OrderStatusBar'
import { OrderFulfillment } from './OrderFulfillment'
import type { WorkspaceOrder } from './order-document-data'

export function PurchaseOrderDetailShell({ order, buyAgainHref, children, notice, relatedQuotationHref }: {
  order?: WorkspaceOrder | null
  buyAgainHref?: string | null
  children: ReactNode
  notice?: ReactNode
  relatedQuotationHref?: string
}) {
  const { t } = useLocalization()
  const status = order?.status?.toLowerCase()
  const knownStatus = status && ['pending', 'in_progress', 'completed', 'cancelled'].includes(status)
  const translatedStatus = status ? t(`status.${status}`) : ''
  const statusLabel = translatedStatus && translatedStatus.toLowerCase() !== `status.${status}`
    ? translatedStatus : status?.replace(/_/g, ' ') || 'Unknown'

  return <div className="flex min-h-[calc(100vh-var(--topbar-height,64px))] flex-1 flex-col bg-muted/30">
    {notice}
    <Tabs defaultValue="details" className="flex flex-1 flex-col">
      <StickyHeader className="print:hidden">
        <div className="flex w-full items-center justify-between gap-3 overflow-x-auto pt-0">
          <div className="flex min-w-0 flex-shrink-0 items-center gap-3">
            <TabsList>
              <TabsTrigger value="details">{t('orders.detail.tabs.details') || 'Details'}</TabsTrigger>
              <TabsTrigger value="shipments" disabled={!order}>{t('orders.detail.tabs.shipments') || 'Shipments'}</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-1">
              <Button asChild variant="ghost" size="sm"><Link href="/purchases/orders"><ChevronLeft className="mr-1 h-4 w-4" />{t('buyer.orders.detail.backToOrders') || 'Back to orders'}</Link></Button>
              {order && <>
                <div className="mx-1 h-6 w-px bg-border" />
                <Button variant="ghost" size="sm" onClick={() => window.print()} className="flex items-center gap-1"><Printer className="h-4 w-4" />{t('common.print') || 'Print'}</Button>
                {buyAgainHref && <>
                  <div className="mx-1 h-6 w-px bg-border" />
                  <Button asChild variant="ghost" size="sm"><Link href={buyAgainHref}><RotateCcw className="mr-1 h-4 w-4" />{t('buyer.orders.buyAgain') || 'Buy Again'}</Link></Button>
                </>}
                {relatedQuotationHref && <>
                  <div className="mx-1 h-6 w-px bg-border" />
                  <Button asChild variant="ghost" size="sm"><Link href={relatedQuotationHref}>View awarded quotation</Link></Button>
                </>}
              </>}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center justify-end gap-3">
            <span className="text-xs text-muted-foreground">Read-only</span>
            {order && (knownStatus
              ? <OrderStatusBar currentStatus={status} onStatusChange={() => {}} disabled />
              : <Badge variant="outline" className="capitalize">{statusLabel}</Badge>)}
          </div>
        </div>
      </StickyHeader>
      <div className="flex-1 overflow-auto p-4 md:p-6 print:overflow-visible print:p-0">
        <TabsContent value="details" className="m-0 border-0 p-0 print:block">
          <div className="mx-auto max-w-[800px] space-y-6">{children}</div>
        </TabsContent>
        <TabsContent value="shipments" className="m-0 border-0 p-0 print:hidden">
          {order && <div className="mx-auto max-w-[800px] overflow-hidden rounded-lg border bg-card"><OrderFulfillment order={order} /></div>}
        </TabsContent>
      </div>
    </Tabs>
  </div>
}