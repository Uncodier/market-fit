"use client"

import React, { useState, useEffect, useLayoutEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { getCartItems, clearCart, CartMode } from "@/app/commerce/cart-storage"
import { cartLineExtendedTotal } from "@/app/commerce/cart-modifiers"
import { getDeviceOrders } from "@/app/commerce/device-order-storage"
import { useGuestCheckoutPrefill } from "@/app/commerce/use-guest-checkout-prefill"
import { buildPublicDocPath } from "@/app/documents/public-token"
import { withInternalFrom } from "@/app/documents/internal-back"
import { ArrowLeft, User } from "@/app/components/ui/icons"
import Link from "next/link"
import { useLocalization } from "@/app/context/LocalizationContext"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"
import { CommerceOrderSuccess } from "@/app/components/commerce/CommerceOrderSuccess"
import { CheckoutForm } from "./CheckoutForm"
import { OrderSummary } from "./OrderSummary"
import { Button } from "@/app/components/ui/button"
import {
  getItemDeliveryOptions,
  intersectDeliveryOptions,
  hasMixedCartShippingWarning,
  intersectPickupLocationIds,
  resolveOrderShippingCost
} from "@/app/commerce/delivery-options"
import { getAvailablePaymentMethods, PaymentMethodType, getItemPaymentOptions, intersectPaymentOptions } from "@/app/commerce/payment-options"
import { pickPreferredPickupLocation } from "@/app/commerce/buyer-location-availability"
import { useNearbyCheckoutDefaults } from "@/app/commerce/use-nearby-checkout-defaults"
import { useShopFulfillmentPreference } from "@/app/commerce/use-shop-fulfillment-preference"
import { useCheckoutSubmission } from "./use-checkout-submission"
import { listPublicLocations } from "@/app/inventory/actions"
import { getSiteInfoBySlug } from "@/app/book/actions"
import { isBusinessOpen, getNextOpenSlot } from "@/app/commerce/business-hours"
import { evaluateLocationRestrictions } from "@/app/commerce/location-restrictions"
import { formatDeliveryTime } from "@/app/commerce/delivery-time"
import type { BuyerGeo } from "@/app/commerce/buyer-geo"
import { useSiteTracking } from "@/app/hooks/useSiteTracking"

export default function CheckoutClient({
  buyerGeo
}: {
  buyerGeo?: BuyerGeo
} = {}) {
  const { t, locale, applyUnresolvedLocale } = useLocalization()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const session = user ? { user } : null

  // URL Params
  const sourceParam = searchParams?.get('source') || 'marketplace'
  const siteId = searchParams?.get('siteId')
  const returnTo = searchParams?.get('returnTo') || (sourceParam === 'shop' && siteId ? `/shop/${siteId}` : '/marketplace')
  const mode = (searchParams?.get('mode') as CartMode) || 'cart'
  const initialOwnerSiteId = searchParams?.get('ownerSiteId')
  const quotationId = searchParams?.get('quotationId')
  const publicAccessToken = searchParams?.get('publicAccessToken')
  const source = quotationId ? 'shop' : sourceParam

  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ownerSiteId, setOwnerSiteId] = useState<string | null>(initialOwnerSiteId)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [successOrderToken, setSuccessOrderToken] = useState<string | null>(null)
  const [successPaymentMethod, setSuccessPaymentMethod] = useState<string>("")
  const [siteSettings, setSiteSettings] = useState<any>(null)

  const continueShoppingHref = (() => {
    if (returnTo.startsWith("/shop/")) {
      const base = returnTo.split("#")[0].split("?")[0]
      return `${base}#your-orders`
    }
    return returnTo.startsWith("/") ? returnTo : "/marketplace"
  })()
  // Contact info
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  // Shipping info
  const [fulfillment, setFulfillment] = useState<'pickup' | 'ship' | 'none' | 'dine_in'>('none')
  const [shippingAddress, setShippingAddress] = useState({ line1: "", line2: "", city: "", state: "", zip: "", country: "" })
  const [locations, setLocations] = useState<any[]>([])
  const [pickupLocationId, setPickupLocationId] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType | ''>('')
  const [promotionCode, setPromotionCode] = useState("")
  const [promoDiscount, setPromoDiscount] = useState(0)

  // Order Timing
  const [orderTiming, setOrderTiming] = useState<'now' | 'scheduled'>('now')
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null)
  const [orderNotes, setOrderNotes] = useState("")

  useGuestCheckoutPrefill({
    session,
    isLoading: authLoading,
    siteId: siteId || null,
    setCustomerName,
    setCustomerEmail,
    setShippingAddress,
  })

  const businessHours = siteSettings?.business_hours || []
  const isOpen = businessHours.length > 0 ? isBusinessOpen(businessHours) : true
  const nextOpenSlot = !isOpen ? getNextOpenSlot(businessHours, new Date(), locale) : null

  const allowedOptions = React.useMemo(() => {
    return intersectDeliveryOptions(items.map((i: any) => ({
      allowed: getItemDeliveryOptions(i, siteSettings?.shop?.default_delivery_options)
    })))
  }, [items, siteSettings]);

  const showMixedCartWarning = React.useMemo(() => {
    return hasMixedCartShippingWarning(items.map((i: any) => ({
      allowed: getItemDeliveryOptions(i, siteSettings?.shop?.default_delivery_options)
    })));
  }, [items, siteSettings]);

  const allowedLocationIds = React.useMemo(() => intersectPickupLocationIds(items), [items])

  const allowedPaymentOptions = React.useMemo(() => {
    return intersectPaymentOptions(items.map((i: any) => ({
      allowed: getItemPaymentOptions(i, siteSettings?.shop?.payment_methods)
    })))
  }, [items, siteSettings])

  const availablePaymentMethods = React.useMemo(
    () => getAvailablePaymentMethods(fulfillment, allowedPaymentOptions, items),
    [fulfillment, allowedPaymentOptions, items]
  )

  const { userChoseFulfillmentRef, setFulfillmentByUser, isPreferenceLoaded } = useShopFulfillmentPreference({
    siteId: source === 'shop' ? siteId : null,
    setFulfillment,
  })

  const { setPaymentMethodByUser } = useNearbyCheckoutDefaults({
    allowedOptions,
    fulfillment,
    setFulfillment,
    availablePaymentMethods,
    paymentMethod,
    setPaymentMethod,
    buyerGeo,
    inventoryLocations: locations,
    settingsLocations: siteSettings?.locations,
    userChoseFulfillmentRef,
    enabled: !loading && isPreferenceLoaded,
  })

  useEffect(() => {
    let currentSiteId = siteId;
    if (source === 'marketplace' && items.length > 0) {
      const uniqueSiteIds = Array.from(new Set(items.map(c => c.site_id)))
      if (uniqueSiteIds.length > 0) {
        currentSiteId = uniqueSiteIds[0];
      }
    }
    if (currentSiteId) {
      // Public storefront path (service role) — buyers are not site members, so RLS blocks listLocations
      listPublicLocations(currentSiteId).then(res => {
        let availableLocations = (res.data || []).filter((l: any) => l.is_active !== false);
        if (allowedLocationIds) {
          availableLocations = availableLocations.filter((l: any) => allowedLocationIds.includes(l.id));
        }
        setLocations(availableLocations);
        if (availableLocations.length > 0) {
          const preferred = pickPreferredPickupLocation(availableLocations, buyerGeo);
          setPickupLocationId(preferred?.id || availableLocations[0].id);
        } else {
          setPickupLocationId("");
        }
      }).catch(console.error);

      // Load site settings (for shop policies)
      getSiteInfoBySlug(currentSiteId).then(site => {
        if (site && site.settings) {
          setSiteSettings(site.settings)
        }
      }).catch(console.error);
    }
  }, [siteId, source, items, allowedLocationIds, buyerGeo]);

  useLayoutEffect(() => {
    if (!siteSettings?.default_locale) return
    void applyUnresolvedLocale(siteSettings.default_locale)
  }, [siteSettings?.default_locale, applyUnresolvedLocale]);

  useEffect(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    const justOrdered =
      url.searchParams.get("ordered") === "1" ||
      url.searchParams.get("success") === "true"

    if (justOrdered) {
      const cartBeforeClear = getCartItems(mode, source, siteId)
      const checkoutSiteId = siteId || cartBeforeClear[0]?.site_id || null
      clearCart(mode, source, siteId)
      setItems([])
      // Prefer device-cache token for this seller
      let token: string | null = null
      if (checkoutSiteId) {
        token = getDeviceOrders(checkoutSiteId)[0]?.publicAccessToken || null
      }
      if (!token) {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (!key?.startsWith("market-device-orders-")) continue
            const parsed = JSON.parse(localStorage.getItem(key) || "[]")
            if (Array.isArray(parsed) && parsed[0]?.publicAccessToken) {
              token = parsed[0].publicAccessToken
              break
            }
          }
        } catch {
          // ignore
        }
      }
      setSuccessOrderToken(token)
      if (url.searchParams.get("pay") === "bank_transfer") {
        setSuccessPaymentMethod("bank_transfer")
      }
      setOrderSuccess(true)
      url.searchParams.delete("ordered")
      url.searchParams.delete("success")
      url.searchParams.delete("order_id")
      url.searchParams.delete("pay")
      window.history.replaceState({}, "", url.pathname + url.search)
      setLoading(false)
      return
    }

    const loadedItems = getCartItems(mode, source, siteId).filter(
      (item: any) => source !== "shop" || !siteId || !item.site_id || item.site_id === siteId
    )
    setItems(loadedItems)
    setLoading(false)
  }, [mode, source, siteId])

  const subtotal = items.reduce((sum, item) => sum + cartLineExtendedTotal(item), 0)

  const shippingCost = React.useMemo(() => resolveOrderShippingCost(
      fulfillment,
      subtotal,
      siteSettings?.shop?.free_shipping_threshold,
      siteSettings?.shop?.shipping_cost,
      items
  ), [fulfillment, subtotal, siteSettings, items])
  const payableTotal = Math.max(0, subtotal - promoDiscount + shippingCost)

  const requiresAuth = items.some(item => item.kind === 'digital_asset' || item.is_recurring)

  const resolvedCheckoutSiteId = (() => {
    if (source === 'marketplace' && items.length > 0) {
      return items[0]?.site_id || siteId || undefined
    }
    return siteId || undefined
  })()

  const { identifyLead } = useSiteTracking(resolvedCheckoutSiteId)

  // Identify lead when contact info is sufficiently provided, with debounce to avoid spamming the API
  useEffect(() => {
    const resolvedName = customerName || session?.user?.user_metadata?.name || session?.user?.user_metadata?.full_name || session?.user?.email
    const resolvedEmail = customerEmail || session?.user?.email
    if (!resolvedName && !resolvedEmail) return

    const timeoutId = setTimeout(() => {
      identifyLead({
        name: resolvedName,
        email: resolvedEmail
      })
    }, 1500) // 1.5 second debounce

    return () => clearTimeout(timeoutId)
  }, [customerName, customerEmail, session, identifyLead])

  const isLocationAvailable = React.useMemo(() => {
    if (!siteSettings?.locations || siteSettings.locations.length === 0) return true;
    // If we have a filled shipping address, use it
    if (fulfillment === 'ship' && shippingAddress.city && shippingAddress.zip) {
      return evaluateLocationRestrictions(siteSettings.locations, shippingAddress).available;
    }
    // Otherwise fallback to buyer geo (IP)
    if (buyerGeo) {
      return evaluateLocationRestrictions(siteSettings.locations, buyerGeo).available;
    }
    return true;
  }, [siteSettings, shippingAddress, fulfillment, buyerGeo]);

  const isPurelyReservableOrDigital = items.length > 0 && items.every(item => item.is_reservation || item.kind === 'digital_asset');

  const deliveryTimeLabel = formatDeliveryTime(siteSettings?.shop);

  const { handleCheckout, checkoutLoading } = useCheckoutSubmission({
    items, session, siteId, source, mode, returnTo, initialOwnerSiteId, ownerSiteId,
    quotationId, publicAccessToken, fulfillment, shippingAddress, pickupLocationId,
    paymentMethod, promotionCode, payableTotal, customerName, customerEmail,
    requiresAuth, isLocationAvailable, isPurelyReservableOrDigital, orderTiming,
    scheduledFor, orderNotes, isOpen, nextOpenSlot, t, setItems,
    setSuccessOrderToken, setSuccessPaymentMethod, setOrderSuccess,
  })

  if (loading) {
    return <div className="min-h-screen bg-muted/30 flex items-center justify-center">Loading checkout...</div>
  }

  if (orderSuccess) {
    const orderHref = successOrderToken
      ? withInternalFrom(
          buildPublicDocPath("so", successOrderToken),
          continueShoppingHref.split("#")[0]
        )
      : null
    return (
      <CommerceOrderSuccess
        title={t("checkout.success.title") || "Order Confirmed"}
        description={t("checkout.success.desc") || "Thank you for your purchase. You can view your order summary or keep shopping."}
        continueLabel={t("checkout.success.continueShopping") || "Continue shopping"}
        primaryHref={orderHref || undefined}
        primaryLabel={orderHref ? t("checkout.success.viewOrder") || "View order summary" : undefined}
        paymentMethod={successPaymentMethod}
        bankTransfer={siteSettings?.shop?.bank_transfer}
        onContinue={() => router.push(continueShoppingHref)}
      />
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col">
        <div className="h-4 w-full shrink-0" />
        <CommerceShellHeader
          brand={
            <Link href={returnTo} className="flex items-center text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="font-medium">{t('checkout.backToStore') || 'Return to store'}</span>
            </Link>
          }
          actions={<div />}
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Checkout empty</h2>
            <p className="text-muted-foreground mb-6">You don&apos;t have any items to checkout.</p>
            <Link href={returnTo}><Button size="lg" className="rounded-xl">Continue Shopping</Button></Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader
        brand={
          <Link href={returnTo} className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="font-medium">{t('checkout.backToStore') || 'Back to store'}</span>
          </Link>
        }
        center={<span className="font-black text-xl tracking-tight uppercase">{t('checkout.title') || 'CHECKOUT'}</span>}
        actions={
          <>
            {session ? (
              <div className="flex items-center gap-2 shrink-0">
                {session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture ? (
                  <img
                    src={session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture}
                      alt="Avatar"
                      className="w-8 h-8 min-w-8 rounded-full object-contain bg-transparent border border-border shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 min-w-8 rounded-full bg-muted flex items-center justify-center border border-border shadow-sm shrink-0">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ) : (
              <Link
                href={`/auth?returnTo=${encodeURIComponent(
                  `/cart/checkout?${new URLSearchParams({
                    ...(source ? { source } : {}),
                    ...(siteId ? { siteId } : {}),
                    ...(mode ? { mode } : {}),
                    ...(initialOwnerSiteId ? { ownerSiteId: initialOwnerSiteId } : {}),
                    ...(returnTo ? { returnTo } : {}),
                  }).toString()}`
                )}`}
                className={shellClasses.primaryCta}
              >
                {t('shop.signIn') || 'Sign In'}
              </Link>
            )}
          </>
        }
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 max-w-[1400px] mx-auto">
          <div className="lg:col-span-7 xl:col-span-8 order-1">
            <div className="bg-card border border-border/50 rounded-3xl p-6 lg:p-10 shadow-sm relative overflow-hidden">
              <CheckoutForm
                session={session}
                requiresAuth={requiresAuth}
                source={source}
                fulfillment={fulfillment}
                setFulfillment={setFulfillmentByUser}
                allowedOptions={allowedOptions}
                customerName={customerName}
                setCustomerName={setCustomerName}
                customerEmail={customerEmail}
                setCustomerEmail={setCustomerEmail}
                shippingAddress={shippingAddress}
                setShippingAddress={setShippingAddress}
                ownerSiteId={ownerSiteId}
                setOwnerSiteId={setOwnerSiteId}
                handleCheckout={handleCheckout}
                lockedDestination={!!initialOwnerSiteId}
                locations={locations}
                pickupLocationId={pickupLocationId}
                setPickupLocationId={setPickupLocationId}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethodByUser}
                availablePaymentMethods={availablePaymentMethods}
                orderTiming={isPurelyReservableOrDigital ? undefined : orderTiming}
                setOrderTiming={isPurelyReservableOrDigital ? undefined : setOrderTiming}
                scheduledFor={scheduledFor}
                setScheduledFor={setScheduledFor}
                orderNotes={orderNotes}
                setOrderNotes={setOrderNotes}
                businessHours={businessHours}
                isOpen={isOpen}
                nextOpenSlot={nextOpenSlot}
                deliveryTimeLabel={deliveryTimeLabel}
                showMixedCartWarning={showMixedCartWarning}
              />
            </div>
          </div>

          <div className="lg:col-span-5 xl:col-span-4 order-2">
            <OrderSummary
              items={items}
              subtotal={subtotal}
              shippingCost={shippingCost}
              checkoutLoading={checkoutLoading}
              disabledReason={
                !isLocationAvailable
                  ? t("checkout.unavailableLocation") || "Service is not available in your area"
                  : (!isPurelyReservableOrDigital && orderTiming === 'scheduled' && !scheduledFor)
                    ? t("checkout.selectTimeRequired") || "Please select a date and time"
                    : !allowedOptions.includes(fulfillment)
                      ? "Selected delivery method not allowed"
                      : (!paymentMethod || !availablePaymentMethods.includes(paymentMethod))
                        ? "Payment method not allowed"
                        : undefined
              }
              fulfillment={fulfillment}
              paymentMethod={paymentMethod}
              siteId={resolvedCheckoutSiteId}
              buyerUserId={session?.user?.id}
              source={source}
              locationId={pickupLocationId || undefined}
              promotionCode={promotionCode}
              setPromotionCode={setPromotionCode}
              promoDiscount={promoDiscount}
              setPromoDiscount={setPromoDiscount}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      {source === 'shop' ? (
        <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12 mt-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-2xl font-black tracking-tight text-gray-400 dark:text-gray-600">{items[0]?.site?.name || 'Store'}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              &copy; {new Date().getFullYear()} {items[0]?.site?.name || 'Store'}. {t("shop.allRightsReserved") || "All rights reserved."}{" "}
              {t("shop.poweredBy") || "Powered by Makinari."}
            </div>
          </div>
        </footer>
      ) : (
        <footer className="bg-card border-t py-12 mt-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-2xl font-black tracking-tight text-muted-foreground">Makinari</div>
            <div className="text-sm text-muted-foreground font-medium">
              &copy; {new Date().getFullYear()} Makinari. {t("marketplace.footer.rights") || "All rights reserved."}{" "}
              {t("marketplace.footer.poweredBy") || "Powered by Makinari."}
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
