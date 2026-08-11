"use client"

import React, { useEffect, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { getPurchaseById } from "@/app/purchases/actions"
import { PublicDocumentView } from "@/app/documents/components/PublicDocumentView"
import { documentT } from "@/app/lib/i18n/document-t"

export default function BillPdfPage(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params)
  const { currentSite } = useSite()
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<any>(null)

  useEffect(() => {
    async function load() {
      if (!currentSite?.id) return
      const res = await getPurchaseById(currentSite.id, params.id)
      if (res.error || !res.purchase) {
        setError(res.error || "Bill not found")
        return
      }
      const purchase = res.purchase
      const locale = currentSite.settings?.default_locale || "en"
      const items = (purchase.items || []).map((item) => ({
        name: item.name || "Item",
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unitCost) || 0,
        subtotal: Number(item.subtotal) || 0,
      }))

      document.title = `Bill - ${purchase.title || purchase.id.substring(0, 8)}`

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
        siteName: currentSite.name || "Bill",
        siteUrl: currentSite.url,
        logoUrl: currentSite.logo_url,
        location: currentSite.settings?.locations?.[0],
        locale,
        statusKind: "bills" as const,
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
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500">
        Loading…
      </div>
    )
  }
  return <PublicDocumentView {...view} />
}
