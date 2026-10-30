"use client"

import { Fragment } from 'react'
import { Badge } from '@/app/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table'
import { useLocalization } from '@/app/context/LocalizationContext'
import { groupedLines, lineAmounts, lineName, money, orderDate, type WorkspaceOrder } from './order-document-data'
import { OrderFulfillment } from './OrderFulfillment'

export function OrderDocument({ order, buyerName }: { order: WorkspaceOrder; buyerName: string }) {
  const { t } = useLocalization()
  const label = (key: string, fallback: string) => {
    const translated = t(key)
    return translated && translated.toLowerCase() !== key.toLowerCase() ? translated : fallback
  }
  const rows = groupedLines(order)
  const currency = order.currency
  return (
    <article aria-label="Purchase order document" className="bg-card rounded-lg shadow-lg overflow-hidden border border-border">
      <header className="p-6 border-b border-border bg-muted/50 flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Purchase Order</p>
          <h1 className="text-2xl font-semibold break-words">{order.order_number || order.id.substring(0, 8)}</h1>
        </div>
        <div className="text-sm sm:text-right space-y-2">
          <Badge variant="outline" className="capitalize">{order.status ? label(`status.${order.status.toLowerCase()}`, order.status) : 'Unknown'}</Badge>
          <div><span className="text-muted-foreground">Order date: </span>{orderDate(order.created_at)}</div>
          {order.due_date && <div><span className="text-muted-foreground">Due date: </span>{orderDate(order.due_date)}</div>}
          {order.scheduled_for && <div><span className="text-muted-foreground">Scheduled for: </span>{orderDate(order.scheduled_for)}</div>}
        </div>
      </header>
      <div className="p-6 grid sm:grid-cols-2 gap-6 border-b border-border">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Buyer</p>
          <p className="font-medium">{buyerName}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label('bills.field.vendor', 'Vendor')}</p>
          <p className="font-medium">{order.site?.name || 'Vendor not available'}</p>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <Table aria-label="Order line items">
          <TableHeader><TableRow>
            <TableHead>{label('buyer.orders.detail.item', 'Item')}</TableHead>
            <TableHead className="text-right">{label('buyer.orders.detail.qty', 'Qty')}</TableHead>
            <TableHead className="text-right whitespace-nowrap">{label('buyer.orders.detail.price', 'Price')}</TableHead>
            <TableHead className="text-right">{label('buyer.orders.detail.total', 'Total')}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(({ line, modifiers }, index) => (
              <Fragment key={line.id || index}>
                {[line, ...modifiers].map((item, childIndex) => {
                  const amounts = lineAmounts(item)
                  const display = lineName(item)
                  return <TableRow key={item.id || childIndex} className={childIndex ? 'text-muted-foreground' : undefined}>
                    <TableCell className={childIndex ? 'pl-8' : undefined}>
                      <div className="font-medium">{childIndex ? '+ ' : ''}{display.name}</div>
                      {display.variant && <div className="text-xs text-muted-foreground">{display.variant}</div>}
                      {item.description && <div className="text-xs text-muted-foreground whitespace-pre-wrap">{item.description}</div>}
                    </TableCell>
                    <TableCell className="text-right">{amounts.quantity}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{money(amounts.price, currency)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{money(amounts.subtotal, currency)}</TableCell>
                  </TableRow>
                })}
              </Fragment>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{label('bills.empty.lines', 'No line items')}</TableCell></TableRow>}
          </TableBody>
        </Table>
        <dl className="mt-6 ml-auto w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{label('buyer.orders.detail.subtotal', 'Subtotal')}</dt><dd>{money(order.subtotal, currency)}</dd></div>
          {Number(order.discount_total) > 0 && <div className="flex justify-between gap-4"><dt>{label('buyer.orders.detail.discount', 'Discount')}</dt><dd>-{money(order.discount_total, currency)}</dd></div>}
          {Number(order.tax_total) > 0 && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{label('buyer.orders.detail.tax', 'Tax')}</dt><dd>{money(order.tax_total, currency)}</dd></div>}
          <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold"><dt>{label('buyer.orders.detail.total', 'Total')}</dt><dd>{money(order.total, currency)}</dd></div>
        </dl>
        {order.notes && <section className="mt-6 border-t pt-4"><h2 className="text-sm font-semibold">Notes</h2><p className="text-sm text-muted-foreground whitespace-pre-wrap mt-2">{order.notes}</p></section>}
      </div>
      <OrderFulfillment order={order} />
    </article>
  )
}
