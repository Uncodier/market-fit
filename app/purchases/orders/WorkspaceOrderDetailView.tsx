"use client"

import { useEffect, useState } from 'react'
import { getBuyerOrder } from '@/app/buyer/actions'
import { useSite } from '@/app/context/SiteContext'
import { useLocalization } from '@/app/context/LocalizationContext'
import { Button } from '@/app/components/ui/button'
import { PurchaseOrderDetailSkeleton } from './order-detail-skeleton'
import { PurchaseOrderDetailShell } from './PurchaseOrderDetailShell'
import { OrderDocument } from './OrderDocument'
import { orderLines, type WorkspaceOrder } from './order-document-data'

export function WorkspaceOrderDetailView({ orderId }: { orderId: string }) {
  return <OrderDetail key={orderId} orderId={orderId} />
}

function OrderDetail({ orderId }: { orderId: string }) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const [order, setOrder] = useState<WorkspaceOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const result = await getBuyerOrder(orderId)
        if (!active) return
        if (result.error || !result.data) {
          setError(result.error || 'Order not found')
        } else {
          setOrder(result.data)
          window.dispatchEvent(new CustomEvent('breadcrumb:update', {
            detail: {
              title: result.data.order_number || 'Purchase Order',
              path: `/purchases/orders/${orderId}`,
              parent: { title: 'Online purchases', path: '/purchases/orders' },
            },
          }))
        }
      } catch {
        if (active) setError('Unable to load this order. Please try again.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [orderId, attempt])

  const lines = order ? orderLines(order) : []
  const buyAgainHref = order?.sale_order_items?.length && order.site
    ? lines.length === 1 && lines[0].catalog_item_id
      ? `/shop/${order.site.id}/${lines[0].catalog_item_id}`
      : `/shop/${order.site.id}`
    : null
  const buyerName = order?.owner_site_id
    ? currentSite?.id === order.owner_site_id ? currentSite.name || 'Workspace buyer' : 'Workspace buyer'
    : 'Personal purchase'

  if (loading) return <PurchaseOrderDetailSkeleton />

  return <PurchaseOrderDetailShell order={!loading && !error ? order : null} buyAgainHref={buyAgainHref}>
        {error || !order ? <div role="alert" className="bg-card border rounded-lg p-6 space-y-4">
            <h1 className="text-xl font-semibold">{t('buyer.orders.detail.notFoundTitle') || 'Order not found'}</h1>
            <p className="text-sm text-muted-foreground">{error || 'We could not find this order.'}</p>
            <Button variant="outline" size="sm" onClick={() => { setError(null); setOrder(null); setLoading(true); setAttempt(value => value + 1) }}>Retry</Button>
          </div>
            : <OrderDocument order={order} buyerName={buyerName} />}
  </PurchaseOrderDetailShell>
}
