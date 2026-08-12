"use client"

import React, { useEffect, useState } from "react"
import { getBillByPublicToken } from "@/app/bills/send-actions"
import { PublicDocumentView } from "@/app/documents/components/PublicDocumentView"
import { PublicDocumentViewSkeleton } from "@/app/documents/components/PublicDocumentViewSkeleton"
import { documentT } from "@/app/lib/i18n/document-t"

export default function PublicBillPage(props: {
  params: Promise<{ token: string }>
}) {
  const params = React.use(props.params)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const res = await getBillByPublicToken(params.token)
      if (res.error || !res.data || !res.raw) {
        setError(res.error || "Bill not found")
        return
      }
      const purchase = res.data
      const branding = res.branding
      const locale = branding?.locale || "en"
      const items = (purchase.items || []).map((item) => ({
        name: item.name || "Item",
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unitCost) || 0,
        subtotal: Number(item.subtotal) || 0,
      }))

      setView({
        kindLabel: documentT(locale, "bills.detail.breadcrumb") || "Bill",
        docRef: String(purchase.id).substring(0, 8),
        title: purchase.title,
        status: purchase.status,
        currency: purchase.currency,
        createdAt: purchase.purchaseDate || purchase.createdAt,
        subtotal: purchase.amount,
        taxTotal: 0,
        discountTotal: 0,
        total: purchase.amount,
        items,
        party: {
          name: purchase.vendorName,
          email: purchase.vendorEmail,
        },
        siteId: res.raw.site?.id || branding?.site?.id || purchase.siteId || null,
        siteName: res.raw.site?.name || branding?.site?.name || "Bill",
        siteUrl: res.raw.site?.url || branding?.site?.url,
        logoUrl: res.raw.site?.logo_url || branding?.site?.logo_url,
        location: branding?.location,
        locale,
        statusKind: "bills" as const,
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
