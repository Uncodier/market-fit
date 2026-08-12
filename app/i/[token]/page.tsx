"use client"

import React, { useEffect, useState } from "react"
import { getSaleByPublicToken } from "@/app/sales/send-actions"
import { PublicDocumentView } from "@/app/documents/components/PublicDocumentView"
import { PublicDocumentViewSkeleton } from "@/app/documents/components/PublicDocumentViewSkeleton"
import { mapDocumentLineItems } from "@/app/documents/map-document-items"
import { documentT } from "@/app/lib/i18n/document-t"

export default function PublicInvoicePage(props: {
  params: Promise<{ token: string }>
}) {
  const params = React.use(props.params)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const res = await getSaleByPublicToken(params.token)
      if (res.error || !res.data) {
        setError(res.error || "Invoice not found")
        return
      }
      const sale = res.data
      const order = res.saleOrder
      const branding = res.branding
      const locale = branding?.locale || "en"
      const mapped = mapDocumentLineItems(order?.items || [])
      const items =
        mapped.length > 0
          ? mapped
          : [
              {
                name: sale.product_name || sale.title || "Sale",
                quantity: 1,
                unit_price: Number(sale.amount) || 0,
                subtotal: Number(sale.amount) || 0,
                status: null,
              },
            ]

      setView({
        kindLabel: documentT(locale, "invoice") || "Invoice",
        docRef: String(sale.invoice_number || sale.id).substring(0, 12),
        title: sale.title,
        status: sale.status,
        currency: sale.currency,
        createdAt: sale.sale_date || sale.created_at,
        subtotal: order?.subtotal ?? sale.amount,
        taxTotal: order?.tax_total ?? 0,
        discountTotal: order?.discount_total ?? 0,
        total: order?.total ?? sale.amount,
        items,
        party: { name: sale.leads?.name, email: sale.leads?.email },
        siteId: sale.site?.id || branding?.site?.id || sale.site_id || null,
        siteName: sale.site?.name || branding?.site?.name || "Invoice",
        siteUrl: sale.site?.url || branding?.site?.url,
        logoUrl: sale.site?.logo_url || branding?.site?.logo_url,
        location: branding?.location,
        locale,
        statusKind: "sales" as const,
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
