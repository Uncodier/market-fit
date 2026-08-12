"use client"

import React, { useEffect, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { getOrder } from "@/app/orders/actions"
import { PublicDocumentView } from "@/app/documents/components/PublicDocumentView"
import { PublicDocumentViewSkeleton } from "@/app/documents/components/PublicDocumentViewSkeleton"
import { resolveSalePaymentMethod } from "@/app/documents/document-meta"
import { mapDocumentLineItems } from "@/app/documents/map-document-items"
import { documentT } from "@/app/lib/i18n/document-t"

export default function OrderPdfPage(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params)
  const { currentSite } = useSite()
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const res = await getOrder(params.id)
      if (res.error || !res.data) {
        setError(res.error || "Order not found")
        return
      }
      const order = res.data as any
      const locale = currentSite?.settings?.default_locale || "en"
      const items = mapDocumentLineItems(
        order.sale_order_items?.length
          ? order.sale_order_items
          : order.items || []
      )

      document.title = `Order - ${String(order.order_number || order.id).substring(0, 12)}`

      setView({
        kindLabel: documentT(locale, "orders.detail.breadcrumbOrder") || "Order",
        docRef: String(order.order_number || order.id).substring(0, 12),
        status: order.status,
        currency: order.currency || currentSite?.settings?.currency,
        createdAt: order.created_at,
        subtotal: order.subtotal,
        taxTotal: order.tax_total,
        discountTotal: order.discount_total,
        total: order.total,
        items,
        party: {
          name: order.leads?.name,
          email: order.leads?.email,
        },
        siteId: currentSite?.id || order.site_id || order.owner_site_id || null,
        siteName: currentSite?.name || "Order",
        siteUrl: currentSite?.url,
        logoUrl: currentSite?.logo_url,
        location: currentSite?.settings?.locations?.[0],
        locale,
        statusKind: "orders" as const,
        fulfillmentMethod: order.fulfillment_method,
        paymentMethod: resolveSalePaymentMethod(order.sales),
        shippingAddress: order.shipping_address,
      })
    }
    load()
  }, [params.id, currentSite])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        {error}
      </div>
    )
  }
  if (!view) {
    return <PublicDocumentViewSkeleton />
  }
  return <PublicDocumentView {...view} />
}
