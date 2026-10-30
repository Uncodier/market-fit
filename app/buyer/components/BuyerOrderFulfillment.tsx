import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Truck, Package, Calendar } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { addressLines, displayValue, formatOrderDate, statusTone, type BuyerOrderDetail, type BuyerShipment } from "../order-detail-display"

function ShipmentDates({ shipment }: { shipment: BuyerShipment }) {
  const { t, locale } = useLocalization()
  return <dl className="space-y-2 text-sm">
    {(['estimated_delivery_at', 'shipped_at', 'delivered_at'] as const).map(field => {
      const date = formatOrderDate(shipment[field], locale)
      if (!date || (field === 'estimated_delivery_at' && ['delivered', 'cancelled', 'failed'].includes(shipment.status || ''))) return null
      return <div key={field} className="flex flex-wrap justify-between gap-2">
        <dt className="text-muted-foreground">{t(`buyer.orders.detail.${field}`)}</dt>
        <dd><time dateTime={shipment[field] || undefined}>{date}</time></dd>
      </div>
    })}
  </dl>
}

export function BuyerOrderStatus({ order }: { order: BuyerOrderDetail }) {
  const { t, locale } = useLocalization()
  const shipments = order.shipments || []
  const scheduled = formatOrderDate(order.scheduled_for, locale)
  return <Card>
    <CardHeader className="flex flex-row flex-wrap items-center gap-3 p-4 md:px-6 space-y-0">
      <Package className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex flex-wrap items-center gap-3">
        <CardTitle className="text-base">{t('buyer.orders.detail.orderStatus')}</CardTitle>
        <Badge variant="outline" className={statusTone(order.status)}>{displayValue(order.status, 'buyer.orders.status', t)}</Badge>
      </div>
      {!shipments.length && !scheduled && order.fulfillment_method === 'ship' && <p className="text-sm text-muted-foreground md:ml-auto">{t('buyer.orders.detail.noShipment')}</p>}
    </CardHeader>
    {(scheduled || shipments.length > 0) && <CardContent className="space-y-4 px-4 pb-4 md:px-6">
      {scheduled && <p className="flex flex-wrap items-center gap-2 text-sm">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">{t('buyer.orders.detail.scheduledFor')}</span>
        <time dateTime={order.scheduled_for || undefined}>{scheduled}</time>
      </p>}
      {shipments.length ? <div className="grid gap-4 sm:grid-cols-2">
        {shipments.map((shipment, index) => <div key={shipment.id} className="rounded-md border bg-muted/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">{t('buyer.orders.detail.shipment', { number: index + 1 })}</span>
            <Badge variant="secondary">{displayValue(shipment.status, 'buyer.orders.status', t)}</Badge>
          </div>
          <ShipmentDates shipment={shipment} />
          <a href={`#shipment-${shipment.id}`} className="text-sm underline underline-offset-4 hover:text-muted-foreground">
            {t('buyer.orders.detail.deliveryDetails')}
          </a>
        </div>)}
      </div> : null}
    </CardContent>}
  </Card>
}

export function BuyerOrderFulfillment({ order }: { order: BuyerOrderDetail }) {
  const { t } = useLocalization()
  const lines = addressLines(order.shipping_address)
  return <Card>
    <CardHeader className="flex flex-row items-center gap-2 p-4 md:px-6">
      <Truck className="h-5 w-5 text-muted-foreground" />
      <CardTitle className="text-base">{t('buyer.orders.detail.delivery')}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4 text-sm px-4 pb-4 md:px-6 md:pb-6">
      {order.fulfillment_method && <div>
        <p className="text-muted-foreground">{t('buyer.orders.detail.method')}</p>
        <p className="font-medium">{displayValue(order.fulfillment_method, 'buyer.orders.fulfillment', t)}</p>
      </div>}
      {lines.length > 0 && <div>
        <p className="text-muted-foreground mb-2">{t('buyer.orders.detail.shippingAddress')}</p>
        <address className="not-italic bg-muted/50 p-3 rounded-md break-words">{lines.map((line, index) => <div key={index}>{line}</div>)}</address>
      </div>}
      {(order.shipments || []).map((shipment, index) => <section key={shipment.id} id={`shipment-${shipment.id}`} className="border-t pt-4 space-y-3 scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-medium">{t('buyer.orders.detail.shipment', { number: index + 1 })}</h4>
          <Badge variant="secondary">{displayValue(shipment.status, 'buyer.orders.status', t)}</Badge>
        </div>
        {shipment.carrier && <p><span className="text-muted-foreground">{t('buyer.orders.detail.carrier')}: </span>{shipment.carrier}</p>}
        {shipment.tracking_number && <p className="break-all"><span className="text-muted-foreground">{t('buyer.orders.detail.tracking')}: </span><span className="font-mono select-all">{shipment.tracking_number}</span></p>}
        <ShipmentDates shipment={shipment} />
        {addressLines(shipment.shipping_address).length > 0 && <address className="not-italic bg-muted/50 p-3 rounded-md break-words">
          <p className="text-muted-foreground mb-1">{t('buyer.orders.detail.shippingAddress')}</p>
          {addressLines(shipment.shipping_address).map((line, i) => <div key={i}>{line}</div>)}
        </address>}
      </section>)}
      {!order.fulfillment_method && !lines.length && !order.shipments?.length && <p className="text-muted-foreground">{t('buyer.orders.detail.noDelivery')}</p>}
    </CardContent>
  </Card>
}