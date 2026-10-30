"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getBuyerOrder } from "@/app/buyer/actions"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { ChevronLeft, Package, RotateCcw } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { formatOrderDate, recordedAmount, type Amount, type BuyerOrderDetail } from "../order-detail-display"
import { BuyerOrderItems } from "./BuyerOrderItems"
import { BuyerOrderAccess } from "./BuyerOrderAccess"
import { BuyerOrderStatus, BuyerOrderFulfillment } from "./BuyerOrderFulfillment"
import { BuyerOrderSummary, BuyerOrderPayment } from "./BuyerOrderPayment"
import type { WorkspaceOrder } from "@/app/purchases/orders/order-document-data"
import { previewOrderDisplay } from "../order-preview-display"

export interface BuyerOrderDetailViewProps {
  orderId: string
  backHref?: string
  previewOrder?: WorkspaceOrder
}

export function BuyerOrderDetailView({ orderId, backHref = "/buyer/orders", previewOrder }: BuyerOrderDetailViewProps) {
  const router = useRouter()
  const { t, locale } = useLocalization()
  const [liveOrder, setOrder] = useState<BuyerOrderDetail | null>(null)
  const order = previewOrder ? previewOrderDisplay(previewOrder) : liveOrder
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (previewOrder) {
      window.dispatchEvent(new CustomEvent('breadcrumb:update', {
        detail: { title: previewOrder.order_number || 'Purchase Order' }
      }))
      return
    }
    let active = true
    async function loadOrder() {
      setLoading(true)
      setError(false)
      setOrder(null)
      try {
        const res = await getBuyerOrder(orderId)
        if (!active) return
        if (res.error || !res.data) {
          setError(true)
        } else {
          setOrder(res.data)
          window.dispatchEvent(new CustomEvent('breadcrumb:update', {
            detail: { title: res.data.order_number || 'Purchase Order' }
          }))
        }
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadOrder()
    return () => { active = false }
  }, [orderId, previewOrder])

  if (!previewOrder && loading) return <div className="space-y-6 py-4" role="status" aria-label={t('common.loading')} aria-busy="true">
    <Skeleton className="h-5 w-36" />
    <Skeleton className="h-12 w-3/4 max-w-lg" />
    <Skeleton className="h-16 w-full" />
    <Skeleton className="h-64 w-full" />
    <div className="grid gap-6 md:grid-cols-2"><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>
  </div>

  if ((!previewOrder && error) || !order) return <div className="p-8 flex items-center justify-center min-h-[300px]">
    <EmptyCard icon={<Package size={32} className="text-muted-foreground" />}
      title={t('buyer.orders.detail.notFoundTitle')}
      description={t('buyer.orders.detail.notFoundDesc')}
      actionButton={<Button onClick={() => router.push(backHref)}><ChevronLeft className="w-4 h-4 mr-2" />{t('buyer.orders.detail.backToOrders')}</Button>}
    />
  </div>

  const hasLines = Boolean(order.sale_order_items?.length)
  const items = hasLines ? order.sale_order_items || [] : order.items || []
  const parentItems = items.filter(item => !item.metadata?.is_modifier && !item.parent_sale_order_item_id)
  const formatCurrency = (value: Amount) => {
    const amount = recordedAmount(value)
    if (amount === null) return '—'
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: order.currency || 'USD' }).format(amount)
    } catch {
      return `${new Intl.NumberFormat(locale).format(amount)} ${order.currency || 'USD'}`
    }
  }
  const created = formatOrderDate(order.created_at, locale)

  return <div className="flex-1 min-w-0 space-y-6 pb-12">
    <header className="space-y-4 pt-2">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />{t('buyer.orders.detail.backToOrders')}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3 min-w-0">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight break-words">
            {t('buyer.orders.detail.title')} {order.order_number || order.id.substring(0, 8)}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {order.site && <span>{t('buyer.orders.detail.from')} <span className="font-medium text-foreground">{order.site.name}</span></span>}
            {created && <span>{t('buyer.orders.detail.orderedOn')} <time dateTime={order.created_at}>{created}</time></span>}
          </div>
        </div>
        {parentItems.length > 0 && order.site && <Button variant="outline" size="sm" disabled={Boolean(previewOrder)} className="rounded-full gap-2" onClick={() => {
          const itemId = parentItems.length === 1 ? parentItems[0].catalog_item_id : null
          router.push(`/shop/${order.site!.id}${itemId ? `/${itemId}` : ''}`)
        }}><RotateCcw className="h-4 w-4" />{t('buyer.orders.buyAgain')}</Button>}
      </div>
    </header>
    <BuyerOrderStatus order={order} />
    <BuyerOrderItems orderItems={items} hasLines={hasLines} formatCurrency={formatCurrency}>
      <BuyerOrderSummary order={order} formatCurrency={formatCurrency} />
    </BuyerOrderItems>
    <div className="grid gap-6 md:grid-cols-2 items-start">
      <BuyerOrderFulfillment order={order} />
      <BuyerOrderPayment order={order} formatCurrency={formatCurrency} demo={Boolean(previewOrder)} />
    </div>
    <BuyerOrderAccess entitlements={order.entitlements || []} reservations={order.reservations || []} />
  </div>
}