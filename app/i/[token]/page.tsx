"use client"

import React, { useEffect, useState } from "react"
import { getSaleByPublicToken } from "@/app/sales/send-actions"
import { PublicDocumentView } from "@/app/documents/components/PublicDocumentView"
import { PublicDocumentViewSkeleton } from "@/app/documents/components/PublicDocumentViewSkeleton"
import { mapDocumentLineItems } from "@/app/documents/map-document-items"
import { documentT } from "@/app/lib/i18n/document-t"

import { Button } from "@/app/components/ui/button"
import { CreditCard, Loader2 } from "@/app/components/ui/icons"
import { toast } from "sonner"

export default function PublicInvoicePage(props: {
  params: Promise<{ token: string }>
}) {
  const params = React.use(props.params)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<any>(null)
  const [saleData, setSaleData] = useState<any>(null)
  const [isCheckingOut, setIsCheckingOut] = useState(false)

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
      setSaleData(sale)
    }
    load()
  }, [params.token])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get("success") === "true") {
        toast.success("Payment successful! Your invoice is being processed.")
        window.history.replaceState({}, document.title, window.location.pathname)
      } else if (urlParams.get("canceled") === "true") {
        toast.error("Payment was canceled.")
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }
  }, [])

  const handleCheckout = async () => {
    if (!saleData) return
    setIsCheckingOut(true)
    try {
      const res = await fetch("/api/stripe/checkout/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: saleData.id,
          siteId: saleData.site_id || view.siteId,
          returnUrl: window.location.href.split('?')[0],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to initiate checkout")
      window.location.href = data.url
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to start checkout")
      setIsCheckingOut(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        {error}
      </div>
    )
  }
  if (!view || !saleData) {
    return <PublicDocumentViewSkeleton />
  }

  const amountDue = Number(saleData.amount_due) || 0
  const isCancelled = saleData.status === "cancelled"
  const canPay = !isCancelled && amountDue > 0

  const paymentTitleKey = "sales.payment.title"
  const paymentDescKey = "sales.payment.description"
  const paymentBtnKey = "sales.payment.payNow"

  const paymentTitle = documentT(view.locale, paymentTitleKey) === paymentTitleKey ? "Payment Required" : documentT(view.locale, paymentTitleKey)
  const paymentDesc = documentT(view.locale, paymentDescKey) === paymentDescKey ? "Please complete your payment to process this invoice." : documentT(view.locale, paymentDescKey)
  const paymentBtn = documentT(view.locale, paymentBtnKey) === paymentBtnKey ? "Pay Now" : documentT(view.locale, paymentBtnKey)

  return (
    <PublicDocumentView {...view}>
      {canPay && (
        <div className="bg-white dark:bg-[#0a0a0a] p-6 sm:p-8 rounded-lg shadow-sm border border-black/5 dark:border-white/10 print:hidden flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {paymentTitle}
            </h3>
            <p className="text-base text-gray-500 dark:text-gray-400">
              {paymentDesc}
            </p>
          </div>
          <Button
            size="lg"
            onClick={handleCheckout}
            disabled={isCheckingOut}
            className="w-full sm:w-auto h-12 px-8 text-base shadow-sm"
          >
            {isCheckingOut ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-5 w-5" />
            )}
            {paymentBtn}
          </Button>
        </div>
      )}
    </PublicDocumentView>
  )
}
