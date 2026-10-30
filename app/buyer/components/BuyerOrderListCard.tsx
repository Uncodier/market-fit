import Image from 'next/image'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { LayoutGrid } from '@/app/components/ui/icons'
import { useLocalization } from '@/app/context/LocalizationContext'
import { resolveItemImage } from '@/app/lib/image-utils'
import { displayValue, recordedAmount, statusTone, type BuyerOrderDetail } from '../order-detail-display'
import { BuyerOrderPayAction } from './BuyerOrderPayAction'
import { orderPaymentState } from '../order-payment'

export function BuyerOrderListCard({ order, demo, onView, onBuyAgain }: {
  order: BuyerOrderDetail & { owner_site_id?: string | null }
  demo: boolean
  onView: () => void
  onBuyAgain: (itemId?: string | null) => void
}) {
  const { t, locale } = useLocalization()
  const items = (order.sale_order_items?.length ? order.sale_order_items : order.items || [])
    .filter(item => !item.metadata?.is_modifier && !item.parent_sale_order_item_id)
  const amount = recordedAmount(order.total)
  let total = '—'
  if (amount !== null) {
    try {
      total = new Intl.NumberFormat(locale, { style: 'currency', currency: order.currency || 'USD' }).format(amount)
    } catch {
      total = `${new Intl.NumberFormat(locale).format(amount)} ${order.currency || 'USD'}`
    }
  }
  const date = new Date(order.created_at)
  const dateLabel = Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date) : null
  return <Card className="overflow-hidden rounded-xl border-border/70">
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b bg-muted/20 px-4 py-3 md:px-5">
      <div className="min-w-0 space-y-1">
        <button onClick={onView} className="font-semibold text-sm hover:underline underline-offset-4 text-left break-all">
          {order.order_number || order.id.substring(0, 8)}
        </button>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {dateLabel && <time dateTime={order.created_at}>{dateLabel}</time>}
          {order.site?.name && <span className="break-words">{order.site.name}</span>}
          {order.owner_site_id && <span>{t('buyer.orders.business')}</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline" className={statusTone(order.status)}>{displayValue(order.status, 'buyer.orders.status', t)}</Badge>
        <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{total}</span>
      </div>
    </div>
    <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:gap-6 md:p-5">
      <div className="flex-1 min-w-0 space-y-4">
        {items.slice(0, 3).map((item, index) => {
          const image = resolveItemImage({ ...item.catalog_item, name: item.name })
          const name = item.metadata?.parent_name || item.name
          return <div key={item.id || index} className="flex items-start gap-3">
            <div className="h-14 w-14 bg-muted rounded-md shrink-0 overflow-hidden border">
              {image ? <Image src={image} alt={item.name} width={56} height={56} unoptimized className="h-full w-full object-cover" />
                : <div className="h-full w-full flex items-center justify-center text-muted-foreground"><LayoutGrid className="h-6 w-6 opacity-30" /></div>}
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium break-words">{name}</p>
              {item.metadata?.parent_name && <p className="text-xs text-muted-foreground break-words">{item.name}</p>}
              <p className="text-xs text-muted-foreground">{t('buyer.orders.detail.qty')}: {item.quantity}</p>
            </div>
          </div>
        })}
        {items.length > 3 && <button onClick={onView} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          {t('buyer.orders.moreItems', { count: items.length - 3 })}
        </button>}
        {!items.length && <p className="text-sm text-muted-foreground">{t('buyer.orders.noItemDetails')}</p>}
      </div>
      <div className="flex flex-wrap gap-2 md:flex-col md:w-44 shrink-0">
        <BuyerOrderPayAction key={order.id} order={order} demo={demo} compact />
        <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={onView}>{t('buyer.orders.viewPurchase')}</Button>
        {!orderPaymentState(order) && items.length > 0 && order.site?.id && <Button variant="ghost" size="sm" className="flex-1 md:flex-none" disabled={demo}
          onClick={() => onBuyAgain(items.length === 1 ? items[0].catalog_item_id : null)}>{t('buyer.orders.buyAgain')}</Button>}
      </div>
    </div>
  </Card>
}