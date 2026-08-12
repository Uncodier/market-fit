import { toast } from "sonner"
import { CheckoutLine } from "@/app/commerce/checkout"
import {
  checkoutCartRequest,
  createStripeOrderCheckout,
  type CheckoutCartSuccess,
} from "@/app/commerce/checkout-client"
import { clearCart } from "@/app/commerce/cart-storage"
import { rememberDeviceOrder } from "@/app/commerce/device-order-storage"
import {
  toCheckoutModifiers,
  type CartModifier,
} from "@/app/commerce/cart-modifiers"
import type { CatalogItem } from "@/app/types"

type CartItem = CatalogItem & {
  cartQty: number
  cartPrice: number
  reservationStart?: string
  reservationEnd?: string
  modifiers?: CartModifier[]
  lineKey?: string
}

type SessionLike = {
  user?: {
    id?: string
    email?: string
    user_metadata?: { name?: string; full_name?: string }
  }
} | null

function cacheDeviceOrder(
  siteId: string,
  res: CheckoutCartSuccess,
  cart: CartItem[]
) {
  if (!res.publicAccessToken) return
  rememberDeviceOrder(siteId, {
    orderId: res.orderId,
    publicAccessToken: res.publicAccessToken,
    orderNumber: res.orderNumber,
    status: res.status,
    total: res.total,
    currency: res.currency,
    createdAt: res.createdAt,
    items: cart.map((c) => ({
      name: c.name,
      imageUrl: c.image_url ?? null,
      unitPrice: c.cartPrice ?? c.target_sale_price ?? null,
    })),
  })
}

export async function runShopCheckout(params: {
  e: React.FormEvent
  cart: CartItem[]
  siteId: string
  siteSlug: string | string[]
  session: SessionLike
  customerName: string
  customerEmail: string
  fulfillment: "pickup" | "ship" | "none" | "dine_in"
  originLocationId: string
  shippingAddress: {
    line1: string
    line2: string
    city: string
    state: string
    zip: string
    country: string
  }
  paymentMethod: string
  orderTiming: "now" | "scheduled"
  scheduledFor: Date | null
  orderNotes?: string
  isOpen: boolean
  nextOpenSlot: { at: Date; label: string } | null
  payableTotal: number
  promotionCode: string
  promotionId: string | null
  ownerSiteId: string | null
  locationAvailable?: boolean
  t: (key: string, vars?: Record<string, string>) => string
  setCheckoutLoading: (v: boolean) => void
  onSuccess: (result: CheckoutCartSuccess) => void
}): Promise<void> {
  const {
    e,
    cart,
    siteId,
    siteSlug,
    session,
    customerName,
    customerEmail,
    fulfillment,
    originLocationId,
    shippingAddress,
    paymentMethod,
    orderTiming,
    scheduledFor,
    orderNotes,
    isOpen,
    nextOpenSlot,
    payableTotal,
    promotionCode,
    promotionId,
    ownerSiteId,
    locationAvailable = true,
    t,
    setCheckoutLoading,
    onSuccess,
  } = params

  e.preventDefault()
  if (cart.length === 0) return

  if (!locationAvailable) {
    toast.error(t("checkout.unavailableLocation") || "Service is not available in your area.")
    return
  }

  const requiresAuth = cart.some((c: any) => c.kind === "digital_asset" || c.is_recurring)
  if (requiresAuth && !session?.user) {
    toast.error(
      t("checkout.identity.signInToAccess") ||
        "Please sign in to purchase digital items or subscriptions."
    )
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
    toast.error("Please enter your name and email")
    return
  }

  if (fulfillment !== "none" && !originLocationId) {
    toast.error("Store location error. Please try again.")
    return
  }

  if (
    fulfillment === "ship" &&
    (!shippingAddress.line1 || !shippingAddress.city || !shippingAddress.zip)
  ) {
    toast.error("Please enter a complete shipping address")
    return
  }

  if (!paymentMethod) {
    toast.error("Please select a payment method")
    return
  }

  if (orderTiming === "scheduled" && !scheduledFor) {
    toast.error(t("checkout.selectTimeRequired") || "Please select a date and time for your order.")
    return
  }

  if (orderTiming === "now" && !isOpen) {
    const confirmed = window.confirm(
      nextOpenSlot?.label
        ? t("checkout.storeClosedConfirm", { time: nextOpenSlot.label }) ||
          `The store is currently closed. Your order will be processed ${nextOpenSlot.label}. Do you want to continue?`
        : t("checkout.storeClosedConfirmGeneric") ||
          "The store is currently closed. Your order will be processed when it opens. Do you want to continue?"
    )
    if (!confirmed) return
  }

  const finalScheduledFor =
    orderTiming === "scheduled" && scheduledFor
      ? scheduledFor.toISOString()
      : orderTiming === "now" && !isOpen && nextOpenSlot
        ? nextOpenSlot.at.toISOString()
        : undefined

  setCheckoutLoading(true)
  let redirectingToStripe = false

  try {
    const lines: CheckoutLine[] = cart.map((c) => ({
      catalogItemId: c.id,
      quantity: c.cartQty,
      reservationStart: c.reservationStart,
      reservationEnd: c.reservationEnd,
      clientLineKey: c.lineKey || c.id,
      unitPriceOverride: c.cartPrice,
      modifiers: toCheckoutModifiers(c.modifiers),
    }))

    const res = await checkoutCartRequest({
      siteId,
      lines,
      customerName: resolvedName,
      customerEmail: resolvedEmail,
      buyerUserId: session?.user?.id,
      ownerSiteId: ownerSiteId,
      fulfillment,
      originLocationId: originLocationId,
      shippingAddress: fulfillment === "ship" ? shippingAddress : undefined,
      promotionCode: promotionCode || undefined,
      promotionId: !promotionCode && promotionId ? promotionId : undefined,
      scheduledFor: finalScheduledFor,
      notes: orderNotes?.trim() || undefined,
      source: "shop",
      paymentMethod:
        paymentMethod === "cash_on_pickup"
          ? "cash"
          : paymentMethod === "bank_transfer"
            ? "bank_transfer"
            : undefined,
      intent:
        payableTotal === 0
          ? "complete"
          : paymentMethod === "cash_on_pickup" || paymentMethod === "bank_transfer"
            ? "send"
            : "draft",
    })

    if (res.error || !res.success) {
      toast.error(res.error || "Checkout failed. Please try again.")
      return
    }

    cacheDeviceOrder(siteId, res, cart)
    clearCart("cart", "shop", siteId)

    // After pay/order, return to the shop “Your orders” section (not the public /so page)
    const shopOrdersUrl =
      window.location.origin + "/shop/" + siteSlug + "?ordered=1#your-orders"

    if (payableTotal > 0 && paymentMethod === "card") {
      const shopReturn = window.location.origin + "/shop/" + siteSlug
      const stripeData = await createStripeOrderCheckout({
        orderId: res.orderId,
        siteId,
        returnUrl: shopReturn,
        successUrl: shopOrdersUrl,
      })
      if (stripeData.url) {
        redirectingToStripe = true
        window.location.href = stripeData.url
        return
      }
      toast.error(stripeData.error || "Failed to initiate payment")
      return
    }

    onSuccess(res)
  } catch (err: any) {
    console.error("Checkout failed:", err)
    toast.error(err?.message || "Checkout failed. Please try again.")
  } finally {
    if (!redirectingToStripe) setCheckoutLoading(false)
  }
}
