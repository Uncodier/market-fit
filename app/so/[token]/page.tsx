"use client"

import React, { useEffect, useState } from "react"
import { getOrderByPublicToken } from "@/app/orders/send-actions"
import { PublicDocumentView } from "@/app/documents/components/PublicDocumentView"
import { PublicDocumentViewSkeleton } from "@/app/documents/components/PublicDocumentViewSkeleton"
import { resolveSalePaymentMethod } from "@/app/documents/document-meta"
import { mapDocumentLineItems } from "@/app/documents/map-document-items"
import { documentT } from "@/app/lib/i18n/document-t"
import { Button } from "@/app/components/ui/button"
import { CreditCard, Loader2 } from "@/app/components/ui/icons"
import { toast } from "sonner"

export default function PublicOrderPage(props: {
  params: Promise<{ token: string }>
}) {
  const params = React.use(props.params)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<any>(null)
  const [orderData, setOrderData] = useState<any>(null)
  const [isCheckingOut, setIsCheckingOut] = useState(false)

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
      setOrderData(order)
    }
    load()
  }, [params.token])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get("success") === "true") {
        toast.success("Payment successful! Your order is being processed.")
        // Remove the query param so it doesn't show again on refresh
        window.history.replaceState({}, document.title, window.location.pathname)
      } else if (urlParams.get("canceled") === "true") {
        toast.error("Payment was canceled.")
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }
  }, [])

  const handleCheckout = async () => {
    if (!orderData) return
    setIsCheckingOut(true)
    try {
      const res = await fetch("/api/stripe/checkout/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderData.id,
          siteId: orderData.site_id || orderData.owner_site_id || view.siteId,
          returnUrl: window.location.href.split('?')[0], // strip any existing query params
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
  if (!view || !orderData) {
    return <PublicDocumentViewSkeleton />
  }

  const amountDue = Number(orderData.sales?.amount_due) || 0
  const isCancelled = orderData.status === "cancelled" || orderData.sales?.status === "cancelled"
  const canPay = !isCancelled && amountDue > 0

  const paymentTitleKey = "orders.payment.title"
  const paymentDescKey = "orders.payment.description"
  const paymentBtnKey = "orders.payment.payNow"

  const paymentTitle = documentT(view.locale, paymentTitleKey) === paymentTitleKey ? "Payment Required" : documentT(view.locale, paymentTitleKey)
  const paymentDesc = documentT(view.locale, paymentDescKey) === paymentDescKey ? "Please complete your payment to process this order." : documentT(view.locale, paymentDescKey)
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
