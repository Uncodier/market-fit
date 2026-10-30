"use client"

import Link from 'next/link'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { useLocalization } from '@/app/context/LocalizationContext'
import { accessDestination, money, orderDate, paymentMethod, type OrderAddress, type WorkspaceOrder } from './order-document-data'

function Address({ address }: { address: OrderAddress }) {
  return <p className="text-sm whitespace-pre-line">{[
    address.name, address.line1, address.line2,
    [address.city, address.state, address.zip].filter(Boolean).join(', '), address.country,
  ].filter(Boolean).join('\n')}</p>
}

export function OrderFulfillment({ order }: { order: WorkspaceOrder }) {
  const { t } = useLocalization()
  const label = (key: string, fallback: string) => t(`buyer.orders.detail.${key}`) || fallback
  const shipments = order.shipments || []
  const payments = order.sales || []
  const entitlements = order.entitlements || []
  const reservations = order.reservations || []
  return <div className="border-t p-6 grid sm:grid-cols-2 gap-6">
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">{label('delivery', 'Delivery')}</h2>
      {!order.fulfillment_method && !order.shipping_address && !shipments.length && <p className="text-sm text-muted-foreground">{label('noDelivery', 'No delivery information for this order.')}</p>}
      {order.fulfillment_method && <div className="text-sm"><p className="text-muted-foreground">{label('method', 'Method')}</p><p className="capitalize">{order.fulfillment_method === 'ship' ? 'Delivery' : order.fulfillment_method.replace(/_/g, ' ')}</p></div>}
      {order.shipping_address && <div><p className="text-sm text-muted-foreground mb-1">{label('shippingAddress', 'Shipping Address')}</p><Address address={order.shipping_address} /></div>}
      {shipments.map(shipment => <div key={shipment.id} className="border-t pt-3 space-y-2 text-sm">
        <Badge variant="secondary" className="capitalize">{shipment.status || 'Unknown'}</Badge>
        {shipment.carrier && <p><span className="text-muted-foreground">{label('carrier', 'Carrier')}: </span>{shipment.carrier}</p>}
        {shipment.tracking_number && <p><span className="text-muted-foreground">{label('tracking', 'Tracking')}: </span><span className="font-mono break-all">{shipment.tracking_number}</span></p>}
        {shipment.estimated_delivery_at && <p>Estimated delivery: {orderDate(shipment.estimated_delivery_at)}</p>}
        {shipment.shipped_at && <p>Shipped: {orderDate(shipment.shipped_at)}</p>}
        {shipment.delivered_at && <p>Delivered: {orderDate(shipment.delivered_at)}</p>}
        {shipment.shipping_address && <Address address={shipment.shipping_address} />}
      </div>)}
    </section>
    {!!payments.length && <section className="space-y-3">
      <h2 className="text-sm font-semibold">{label('payment', 'Payment')}</h2>
      {payments.map((payment, index) => <div key={index} className="space-y-2 text-sm border-b pb-3 last:border-0">
        <Badge variant="outline" className="capitalize">{payment.status || 'Unknown'}</Badge>
        {paymentMethod(payment) && <p className="capitalize"><span className="text-muted-foreground">{label('paymentMethod', 'Payment Method')}: </span>{paymentMethod(payment)?.replace(/_/g, ' ')}</p>}
        <p className="flex justify-between gap-4"><span className="text-muted-foreground">{label('paidAmount', 'Paid Amount')}</span><span>{money(payment.amount, order.currency)}</span></p>
        {payment.amount_due != null && <p className="flex justify-between gap-4"><span className="text-muted-foreground">Amount due</span><span>{money(payment.amount_due, order.currency)}</span></p>}
      </div>)}
    </section>}
    {(!!entitlements.length || !!reservations.length) && <section className="sm:col-span-2 border-t pt-4 space-y-3">
      <h2 className="text-sm font-semibold">{label('access', 'Access & Reservations')}</h2>
      {entitlements.map(access => {
        const destination = accessDestination(access)
        return <div key={access.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div><p className="font-medium">{access.catalog_item?.name || 'Item'}</p><p className="text-xs text-muted-foreground capitalize">{access.catalog_item?.digital_subtype || access.catalog_item?.kind}{access.status ? ` • ${access.status}` : ''}</p></div>
          <Button asChild variant="outline" size="sm"><Link href={destination.href}>{destination.label}</Link></Button>
        </div>
      })}
      {reservations.map(reservation => <div key={reservation.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div><p className="font-medium">{reservation.catalog_item?.name || 'Reservation'}</p><p className="text-xs text-muted-foreground capitalize">{label('reservation', 'Reservation')} • {reservation.status}</p></div>
        <Button asChild variant="outline" size="sm"><Link href={`/buyer/reservations/${reservation.id}`}>{label('viewReservation', 'View Reservation')}</Link></Button>
      </div>)}
    </section>}
  </div>
}
