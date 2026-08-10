"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getBuyerOrder } from "@/app/buyer/actions"
import Link from "next/link"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { ChevronLeft, Package, CheckCircle2, Truck, CreditCard, LayoutGrid, RotateCcw, Ticket, BookOpen, Key, Calendar } from "@/app/components/ui/icons"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { useLocalization } from "@/app/context/LocalizationContext"
import { resolveItemImage } from "@/app/lib/image-utils"
import { EmptyCard } from "@/app/components/ui/empty-card"

export interface BuyerOrderDetailViewProps {
  orderId: string
  backHref?: string
}

export function BuyerOrderDetailView({ 
  orderId, 
  backHref = "/buyer/orders" 
}: BuyerOrderDetailViewProps) {
  const router = useRouter()
  const { t } = useLocalization()
  
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadOrder() {
      setLoading(true)
      const res = await getBuyerOrder(orderId)
      if (res.error) {
        setError(res.error)
      } else {
        setOrder(res.data)
      }
      setLoading(false)
    }
    loadOrder()
  }, [orderId])

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-full">
        <div className="w-full px-4 md:px-8 mt-8 md:mt-12 mb-4">
          <Skeleton className="h-10 md:h-12 lg:h-14 w-3/4 max-w-sm mb-4" />
          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>

        <div className="p-4 md:px-8 flex-1 w-full space-y-6 pb-16">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {[1, 2].map((i) => (
                  <div key={i} className="p-4 flex flex-col md:flex-row gap-4">
                    <Skeleton className="h-16 w-16 rounded-md flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0 md:w-32 justify-between">
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-muted/30 border-t space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <div className="flex justify-between pt-2 border-t mt-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Skeleton className="w-5 h-5 rounded-full" />
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Skeleton className="w-5 h-5 rounded-full" />
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-6 w-24 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <div className="flex justify-between pt-2 border-t mt-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[300px]">
        <EmptyCard 
          icon={<Package size={32} className="text-muted-foreground" />}
          title={t('buyer.orders.detail.notFoundTitle') || "Order not found"}
          description={error || t('buyer.orders.detail.notFoundDesc') || "We couldn't find this order."}
          action={
            <Button onClick={() => router.push(backHref)}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              {t('buyer.orders.detail.backToOrders') || "Back to orders"}
            </Button>
          }
        />
      </div>
    )
  }

  const hasLines = order.sale_order_items && order.sale_order_items.length > 0
  const orderItems = hasLines ? order.sale_order_items : (order.items || [])
  const payment = order.sales?.[0]
  const shipment = order.shipments?.[0]

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency || 'USD' }).format(amount)
  }

  const entitlements = order.entitlements || []
  const reservations = order.reservations || []
  const hasAccessItems = entitlements.length > 0 || reservations.length > 0

  return (
    <div className="flex-1 flex flex-col min-h-full">
      <div className="w-full px-4 md:px-8 mt-8 md:mt-12 mb-4">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-4">
          {t('buyer.orders.detail.title') || 'Purchase'} {order.order_number || order.id.substring(0,8)}
        </h1>
        <div className="text-muted-foreground font-medium flex flex-wrap items-center gap-4">
          <Link
            href={backHref}
            className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-full hover:bg-muted -ml-2"
          >
            <ChevronLeft className="w-3 h-3 mr-1" />
            {t("buyer.orders.detail.backToOrders") || "Back to orders"}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {order.site && (
              <>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span className="truncate max-w-[200px]">{order.site.name}</span>
              </>
            )}
            <span className="w-1 h-1 rounded-full bg-border" />
            <span className="whitespace-nowrap">{format(new Date(order.created_at), 'PPP p')}</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <Badge variant="outline" className={`capitalize shrink-0 ${
              order.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20' : 
              order.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' : 
              'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20'
            }`}>
              {order.status ? (t(`status.${order.status.toLowerCase()}`) || order.status) : 'Unknown'}
            </Badge>
          </div>
          
          {hasLines && order.site && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto flex items-center gap-1.5 rounded-full"
              onClick={() => {
                // If there's only one line, directly go to the PDP to buy again
                // If there are multiple, for now just go to the merchant's home page
                if (orderItems.length === 1 && orderItems[0].catalog_item_id) {
                  router.push(`/shop/${order.site.id}/${orderItems[0].catalog_item_id}`)
                } else {
                  router.push(`/shop/${order.site.id}`)
                }
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t("buyer.orders.buyAgain") || "Buy Again"}
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 md:px-8 flex-1 w-full space-y-6 pb-16">

        <Card>
          <CardHeader>
            <CardTitle>{t('buyer.orders.detail.items') || 'Items'}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {orderItems.map((item: any, i: number) => {
                const img = hasLines ? resolveItemImage({ ...item.catalog_item, name: item.name }) : null
                
                return (
                  <div key={item.id || i} className="p-4 flex flex-col md:flex-row gap-4">
                    {hasLines && (
                      <div className="h-16 w-16 bg-muted rounded-md flex-shrink-0 overflow-hidden border">
                        {img ? (
                          <img src={img} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <LayoutGrid className="w-6 h-6 opacity-20" />
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex-1 space-y-1">
                      <div className="font-medium">{item.name}</div>
                      {item.description && <div className="text-sm text-muted-foreground line-clamp-2">{item.description}</div>}
                      <div className="text-sm text-muted-foreground flex gap-3">
                        <span>{item.quantity} × {formatCurrency(item.unitPrice || item.unit_price || 0)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0 md:w-32 justify-between">
                      <div className="font-medium text-right">
                        {formatCurrency(item.subtotal || ((item.unitPrice || item.unit_price || 0) * (item.quantity || 1)))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-4 bg-muted/30 border-t space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{t('buyer.orders.detail.subtotal') || 'Subtotal'}</span>
                <span>{formatCurrency(Number(order.subtotal) || 0)}</span>
              </div>
              {Number(order.discount_total) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>{t('buyer.orders.detail.discount') || 'Discount'}</span>
                  <span>-{formatCurrency(Number(order.discount_total))}</span>
                </div>
              )}
              {Number(order.tax_total) > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{t('buyer.orders.detail.tax') || 'Tax'}</span>
                  <span>{formatCurrency(Number(order.tax_total))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-2 border-t text-base">
                <span>{t('buyer.orders.detail.total') || 'Total'}</span>
                <span>{formatCurrency(Number(order.total) || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Truck className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-base">{t('buyer.orders.detail.delivery') || 'Delivery'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!order.fulfillment_method && !shipment && !order.shipping_address ? (
                <div className="text-sm text-muted-foreground">
                  {t('buyer.orders.detail.noDelivery') || 'No delivery information for this order.'}
                </div>
              ) : (
                <>
                {order.fulfillment_method && (
                  <div>
                    <div className="text-sm text-muted-foreground">{t('buyer.orders.detail.method') || 'Method'}</div>
                    <div className="font-medium capitalize">
                      {order.fulfillment_method === 'dine_in' ? 'Dine In' : 
                       order.fulfillment_method === 'pickup' ? 'Pickup' : 
                       order.fulfillment_method === 'ship' ? 'Delivery' : order.fulfillment_method}
                    </div>
                  </div>
                )}
                  
                  {order.shipping_address && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">{t('buyer.orders.detail.shippingAddress') || 'Shipping Address'}</div>
                      <div className="text-sm bg-muted/50 p-3 rounded-md">
                        {order.shipping_address.line1}<br/>
                        {order.shipping_address.line2 && <>{order.shipping_address.line2}<br/></>}
                        {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}<br/>
                        {order.shipping_address.country}
                      </div>
                    </div>
                  )}

                  {shipment && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="capitalize">{shipment.status}</Badge>
                      </div>
                      {shipment.carrier && (
                        <div className="text-sm mb-1">
                          <span className="text-muted-foreground">{t('buyer.orders.detail.carrier') || 'Carrier'}:</span> <span className="font-medium">{shipment.carrier}</span>
                        </div>
                      )}
                      {shipment.tracking_number && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">{t('buyer.orders.detail.tracking') || 'Tracking'}:</span> <span className="font-mono">{shipment.tracking_number}</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {payment && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <CreditCard className="w-5 h-5 text-muted-foreground" />
                <CardTitle className="text-base">{t('buyer.orders.detail.payment') || 'Payment'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`capitalize ${
                    payment.status === 'paid' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20' : ''
                  }`}>
                    {payment.status}
                  </Badge>
                </div>
                
                {payment.payment_method && (
                  <div>
                    <div className="text-sm text-muted-foreground">{t('buyer.orders.detail.paymentMethod') || 'Payment Method'}</div>
                    <div className="font-medium capitalize">{payment.payment_method.replace('_', ' ')}</div>
                  </div>
                )}

                <div className="pt-2 border-t">
                  <div className="text-sm flex justify-between">
                    <span className="text-muted-foreground">{t('buyer.orders.detail.paidAmount') || 'Paid Amount'}</span>
                    <span className="font-medium">{formatCurrency(payment.amount || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {hasAccessItems && (
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <Key className="w-5 h-5 text-muted-foreground" />
                <CardTitle className="text-base">{t('buyer.orders.detail.access') || 'Access'}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {entitlements.map((ent: any) => {
                    const cItem = ent.catalog_item || {}
                    let icon = <BookOpen className="w-5 h-5" />
                    let link = `/buyer/library`
                    let actionText = t('buyer.orders.detail.viewAccess') || 'View Access'

                    if (cItem.kind === 'digital_asset') {
                      if (cItem.digital_subtype === 'course') {
                        link = `/buyer/course/${ent.id}`
                        actionText = t('buyer.orders.detail.viewCourse') || 'View Course'
                      } else if (cItem.digital_subtype === 'ticket') {
                        icon = <Ticket className="w-5 h-5" />
                        link = `/buyer/ticket/${ent.id}`
                        actionText = t('buyer.orders.detail.viewTicket') || 'View Ticket'
                      } else if (cItem.digital_subtype === 'pass') {
                        icon = <Ticket className="w-5 h-5" />
                        link = `/buyer/book/${ent.id}`
                        actionText = t('buyer.orders.detail.viewPass') || 'View Pass'
                      } else {
                        link = `/buyer/downloads/${ent.id}`
                        actionText = t('buyer.orders.detail.viewAsset') || 'View Asset'
                      }
                    }

                    return (
                      <div key={ent.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex flex-shrink-0 items-center justify-center text-muted-foreground">
                            {icon}
                          </div>
                          <div>
                            <div className="font-medium">{cItem.name || 'Item'}</div>
                            <div className="text-xs text-muted-foreground capitalize">{cItem.digital_subtype || cItem.kind}</div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => router.push(link)}>
                          {actionText}
                        </Button>
                      </div>
                    )
                  })}
                  
                  {reservations.map((res: any) => {
                    const cItem = res.catalog_item || {}
                    return (
                      <div key={res.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex flex-shrink-0 items-center justify-center text-muted-foreground">
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium">{cItem.name || 'Reservation'}</div>
                            <div className="text-xs text-muted-foreground capitalize">{t('buyer.orders.detail.reservation') || 'Reservation'} • {res.status}</div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => router.push(`/buyer/reservations/${res.id}`)}>
                          {t('buyer.orders.detail.viewReservation') || 'View Reservation'}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
