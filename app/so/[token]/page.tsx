"use client"

import React, { useEffect, useState } from "react"
import { getOrderByPublicToken } from "@/app/orders/send-actions"
import { PublicDocumentView } from "@/app/documents/components/PublicDocumentView"
import { PublicDocumentViewSkeleton } from "@/app/documents/components/PublicDocumentViewSkeleton"
import { resolveSalePaymentMethod } from "@/app/documents/document-meta"
import { mapDocumentLineItems } from "@/app/documents/map-document-items"
import { documentT } from "@/app/lib/i18n/document-t"

export default function PublicOrderPage(props: {
  params: Promise<{ token: string }>
}) {
  const params = React.use(props.params)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const res = await getOrderByPublicToken(params.token)
      if (res.error || !res.data) {
        setError(res.error || "Order not found")
        return
      }
      const order = res.data
      const branding = res.branding
      const locale = branding?.locale || "en"
      const items = mapDocumentLineItems(order.items)

      setView({
        kindLabel: documentT(locale, "orders.detail.breadcrumbOrder") || "Order",
        docRef: String(order.order_number || order.id).substring(0, 12),
        status: order.status,
        currency: order.currency,
        createdAt: order.created_at,
        subtotal: order.subtotal,
        taxTotal: order.tax_total,
        discountTotal: order.discount_total,
        total: order.total,
        items,
        party: { name: order.leads?.name, email: order.leads?.email },
        siteId: order.site?.id || branding?.site?.id || order.site_id || order.owner_site_id || null,
        siteName: order.site?.name || branding?.site?.name || "Order",
        siteUrl: order.site?.url || branding?.site?.url,
        logoUrl: order.site?.logo_url || branding?.site?.logo_url,
        location: branding?.location,
        locale,
        statusKind: "orders" as const,
        fulfillmentMethod: order.fulfillment_method,
        paymentMethod: resolveSalePaymentMethod(order.sales),
        shippingAddress: order.shipping_address,
      })
    }
    load()
  }, [params.token])

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
