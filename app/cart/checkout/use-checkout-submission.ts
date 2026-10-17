"use client"

import { useState, type FormEvent } from "react"
import type { User } from "@supabase/supabase-js"
import { toast } from "sonner"
import { clearCart, type CartMode } from "@/app/commerce/cart-storage"
import type { CartModifier } from "@/app/commerce/cart-modifiers"
import { rememberDeviceOrder, toDeviceOrderItem, type GuestShippingAddress } from "@/app/commerce/device-order-storage"
import type { CheckoutLine } from "@/app/commerce/checkout"
import { checkoutCartRequest, createStripeOrderCheckout } from "@/app/commerce/checkout-client"
import type { CheckoutFulfillmentMethod } from "@/app/commerce/delivery-options"
import type { PaymentMethodType } from "@/app/commerce/payment-options"

type CheckoutSubmissionItem = Parameters<typeof toDeviceOrderItem>[0] & {
  id: string
  site_id?: string
  currency?: string | null
  cartQty: number
  reservationStart?: string
  reservationEnd?: string
  lineKey?: string
  modifiers?: CartModifier[]
}

export interface CheckoutSubmissionParams {
  items: CheckoutSubmissionItem[]
  session: { user: Pick<User, "id" | "email" | "user_metadata"> } | null
  siteId: string | null | undefined
  source: string
  mode: CartMode
  returnTo: string
  initialOwnerSiteId: string | null | undefined
  ownerSiteId: string | null
  quotationId: string | null | undefined
  publicAccessToken: string | null | undefined
  fulfillment: CheckoutFulfillmentMethod
  shippingAddress: GuestShippingAddress
  pickupLocationId: string
  paymentMethod: PaymentMethodType | ""
  promotionCode: string
  payableTotal: number
  customerName: string
  customerEmail: string
  requiresAuth: boolean
  isLocationAvailable: boolean
  isPurelyReservableOrDigital: boolean
  orderTiming: "now" | "scheduled"
  scheduledFor: Date | null
  orderNotes: string
  isOpen: boolean
  nextOpenSlot: { at: Date; label: string } | null
  t: (key: string, params?: Record<string, string | number>) => string
  setItems: (items: CheckoutSubmissionItem[]) => void
  setSuccessOrderToken: (token: string | null) => void
  setSuccessPaymentMethod: (method: string) => void
  setOrderSuccess: (success: boolean) => void
}

/** Submission and payment handoff; automatic fulfillment defaults stay in the caller. */
export function useCheckoutSubmission({
  items, session, siteId, source, mode, returnTo, initialOwnerSiteId, ownerSiteId,
  quotationId, publicAccessToken, fulfillment, shippingAddress, pickupLocationId,
  paymentMethod, promotionCode, payableTotal, customerName, customerEmail,
  requiresAuth, isLocationAvailable, isPurelyReservableOrDigital, orderTiming,
  scheduledFor, orderNotes, isOpen, nextOpenSlot, t, setItems,
  setSuccessOrderToken, setSuccessPaymentMethod, setOrderSuccess,
}: CheckoutSubmissionParams) {
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const handleCheckout = async (e: FormEvent) => {
    e.preventDefault()

    if (!isLocationAvailable) {
      toast.error(t('checkout.unavailableLocation') || 'Service is not available in your area.')
      return
    }

    if (!isPurelyReservableOrDigital) {
      if (orderTiming === 'scheduled' && !scheduledFor) {
        toast.error(t('checkout.selectTimeRequired') || 'Please select a date and time for your order.')
        return
      }

      if (orderTiming === 'now' && !isOpen) {
        const confirmed = window.confirm(
          nextOpenSlot?.label
            ? (t('checkout.storeClosedConfirm', { time: nextOpenSlot.label }) ||
              `The store is currently closed. Your order will be processed ${nextOpenSlot.label}. Do you want to continue?`)
            : (t('checkout.storeClosedConfirmGeneric') ||
              'The store is currently closed. Your order will be processed when it opens. Do you want to continue?')
        )
        if (!confirmed) return
      }
    }

    const finalScheduledFor = isPurelyReservableOrDigital ? undefined :
                              (orderTiming === 'scheduled' ? scheduledFor?.toISOString() :
                              (orderTiming === 'now' && !isOpen && nextOpenSlot ? nextOpenSlot.at.toISOString() : undefined))

    if (items.length === 0) return

    if (requiresAuth && !session?.user) {
      toast.error(t("checkout.identity.signInToAccess") || "Please sign in to purchase digital items or subscriptions.")
      return
    }

    const resolvedName =
      customerName ||
      session?.user?.user_metadata?.name ||
      session?.user?.user_metadata?.full_name ||
      session?.user?.email ||
      ""
    const resolvedEmail = customerEmail || session?.user?.email || ""

    if (!resolvedName || !resolvedEmail) {
      toast.error(t("checkout.errors.nameEmailRequired"))
      return
    }

    if (source === 'shop' && fulfillment === 'ship' && (!shippingAddress.line1 || !shippingAddress.city || !shippingAddress.zip)) {
      toast.error(t("checkout.errors.shippingAddressRequired"))
      return
    }

    setCheckoutLoading(true)
    let redirectingToStripe = false

    // For marketplace, ensure we only have one seller
    let checkoutSiteId = siteId
    if (source === 'marketplace') {
      const uniqueSiteIds = Array.from(new Set(items.map(c => c.site_id)))
      if (uniqueSiteIds.length > 1) {
        toast.error(t("checkout.errors.singleSeller"))
        setCheckoutLoading(false)
        return
      }
      checkoutSiteId = uniqueSiteIds[0]
    }

    // Ensure cart only has one currency
    const uniqueCurrencies = Array.from(new Set(items.map(c => c.currency || 'USD')))
    if (uniqueCurrencies.length > 1) {
      toast.error(t("checkout.errors.singleCurrency"))
      setCheckoutLoading(false)
      return
    }

    if (!checkoutSiteId) {
      toast.error(t("checkout.errors.missingSeller"))
      setCheckoutLoading(false)
      return
    }

    if (!paymentMethod) {
      toast.error(t("checkout.errors.paymentRequired"))
      setCheckoutLoading(false)
      return
    }

    try {
      const lines: CheckoutLine[] = items.map(c => ({
        catalogItemId: c.id,
        quantity: c.cartQty,
        reservationStart: c.reservationStart,
        reservationEnd: c.reservationEnd,
        clientLineKey: c.lineKey || c.id,
        unitPriceOverride:
          c.cartPrice != null ? Number(c.cartPrice) : undefined,
        modifiers: Array.isArray(c.modifiers)
          ? c.modifiers.map(m => ({
              catalogItemId: m.catalogItemId,
              quantity: m.cartQty,
              unitPriceOverride: m.cartPrice,
              groupId: m.groupId,
            }))
          : undefined,
      }))

      const res = await checkoutCartRequest({
        siteId: checkoutSiteId,
        lines,
        customerName: resolvedName,
        customerEmail: resolvedEmail,
        buyerUserId: session?.user?.id,
        ownerSiteId,
        fulfillment,
        originLocationId: (fulfillment === 'pickup' || fulfillment === 'dine_in') ? pickupLocationId : undefined,
        shippingAddress: fulfillment === 'ship' ? shippingAddress : undefined,
        promotionCode: promotionCode || undefined,
        scheduledFor: finalScheduledFor,
        notes: orderNotes.trim() || undefined,
        source: quotationId ? 'quote' : (source as 'shop' | 'marketplace'),
        quotationId: quotationId || undefined,
        publicAccessToken: publicAccessToken || undefined,
        paymentMethod: paymentMethod === 'cash_on_pickup' ? 'cash' : paymentMethod === 'bank_transfer' ? 'bank_transfer' : undefined,
        intent: payableTotal === 0 ? 'complete' : (paymentMethod === 'cash_on_pickup' || paymentMethod === 'bank_transfer' ? 'send' : 'draft')
      })

      if (res.error || !res.success) {
        toast.error(t("checkout.errors.failed"))
        return
      }

      rememberDeviceOrder(checkoutSiteId, {
        orderId: res.orderId,
        publicAccessToken: res.publicAccessToken,
        orderNumber: res.orderNumber,
        status: res.status,
        total: res.total,
        currency: res.currency,
        createdAt: res.createdAt,
        items: items.map(toDeviceOrderItem),
        customerName: resolvedName,
        customerEmail: resolvedEmail,
        shippingAddress: fulfillment === "ship" ? shippingAddress : undefined,
      })

      const checkoutReturn =
        window.location.origin +
        `/cart/checkout?${new URLSearchParams({
          ...(source ? { source } : {}),
          ...(siteId ? { siteId } : {}),
          ...(mode ? { mode } : {}),
          ...(initialOwnerSiteId ? { ownerSiteId: initialOwnerSiteId } : {}),
          ...(returnTo ? { returnTo } : {}),
          ordered: "1",
          ...(paymentMethod === "bank_transfer" ? { pay: "bank_transfer" } : {}),
        }).toString()}`

      if (payableTotal > 0 && paymentMethod === "card") {
        const stripeData = await createStripeOrderCheckout({
          orderId: res.orderId,
          publicAccessToken: res.publicAccessToken,
          returnUrl: window.location.origin + (returnTo.startsWith("/") ? returnTo : "/marketplace"),
          successUrl: checkoutReturn,
        })
        if (stripeData.url) {
          clearCart(mode, source, siteId)
          redirectingToStripe = true
          window.location.href = stripeData.url
          return
        }
        toast.error(t("checkout.errors.paymentFailed"))
        return
      }

      clearCart(mode, source, siteId)
      setItems([])
      setSuccessOrderToken(res.publicAccessToken || null)
      setSuccessPaymentMethod(paymentMethod || "")
      setOrderSuccess(true)
    } catch (error: unknown) {
      console.error('Checkout failed:', error)
      toast.error(t("checkout.errors.failed"))
    } finally {
      if (!redirectingToStripe) {
        setCheckoutLoading(false)
      }
    }
  }

  return { handleCheckout, checkoutLoading }
}