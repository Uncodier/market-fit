"use client"

import { useMemo, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Tag, Check, Plus, Minus } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { promoBadgeLabel } from "@/app/promotions/promotion-merchandising"
import { buildPromoDetailFacts } from "@/app/promotions/promo-detail-facts"
import { getCartItems, setCartItems } from "@/app/commerce/cart-storage"
import { resolveItemImage, resolvePromotionImage } from "@/app/lib/image-utils"
import { PdpCtaButton } from "@/app/components/commerce/pdp/PdpCtaButton"
import { PdpMobileBuyBar } from "@/app/components/commerce/pdp/PdpMobileBuyBar"
import { PdpMetricChips } from "@/app/components/commerce/pdp/PdpMetricChips"
import { PromoStorefrontShell } from "@/app/components/commerce/PromoStorefrontShell"
import type { PromoBundleSite } from "@/app/components/commerce/PromoStorefrontShell"
import { PromoDetailFacts } from "@/app/components/commerce/PromoDetailFacts"
import {
  writePendingStorefrontPromo,
} from "@/app/components/commerce/storefront-pending-promo"
import { resolvePromotionCurrency } from "@/app/promotions/promotion-currency"
import { cn } from "@/lib/utils"

type RequiredItemRow = {
  catalog_item_id: string
  min_quantity: number
  item?: {
    id: string
    name?: string
    image_url?: string | null
    target_sale_price?: number | null
    currency?: string | null
    site_id?: string
  } | null
}

type PickItem = {
  id: string
  name?: string
  image_url?: string | null
  target_sale_price?: number | null
  currency?: string | null
  category_id?: string | null
  site_id?: string
}

export type PromoBundleData = {
  id: string
  site_id: string
  name: string
  description?: string | null
  code?: string | null
  image_url?: string | null
  discount_type: string
  discount_value?: number | null
  bogo_buy_qty?: number | null
  bogo_get_qty?: number | null
  applies_to?: string | null
  starts_at?: string | null
  ends_at?: string | null
  active_weekdays?: number[] | null
  min_order_amount?: number | null
  usage_limit?: number | null
  usage_limit_per_user?: number | null
  required_items_mode?: "all" | "any" | null
  currency?: string | null
  required_items?: RequiredItemRow[]
  required_categories?: {
    catalog_category_id: string
    min_quantity: number
    category?: { id: string; name?: string } | null
  }[]
  category_pick_items?: PickItem[]
}

export type { PromoBundleSite }

type Props = {
  promo: PromoBundleData
  surface: "shop" | "marketplace"
  backHref: string
  siteSlug?: string
  site?: PromoBundleSite | null
  /** Site default currency when promo.currency is unset. */
  siteCurrency?: string | null
  /** False when outside schedule/weekday/usage window. Page still renders. */
  availableNow?: boolean
}

export function PromoBundleExperience({
  promo,
  surface,
  backHref,
  siteSlug,
  site = null,
  siteCurrency = null,
  availableNow = true,
}: Props) {
  const { t, locale } = useLocalization()
  const { formatPrice } = useDisplayCurrency()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [pickedQty, setPickedQty] = useState<Record<string, number>>({})
  const [cartCount, setCartCount] = useState(0)
  const [subtotal, setSubtotal] = useState(0)
  const [cartCurrency, setCartCurrency] = useState("USD")

  const promoCurrency = resolvePromotionCurrency(promo, siteCurrency)
  const label = promoBadgeLabel(promo, t)
  const imageSrc = resolvePromotionImage(promo)
  const requiredItems = promo.required_items || []
  const pickItems = promo.category_pick_items || []
  const hasConcreteRequired = requiredItems.length > 0
  const cartSource = surface === "marketplace" ? "marketplace" : "shop"
  const cartSiteId = surface === "shop" ? promo.site_id : null

  const detailFacts = useMemo(
    () =>
      buildPromoDetailFacts(
        { ...promo, currency: promoCurrency },
        {
          t,
          formatPrice,
          locale,
        },
      ),
    [promo, promoCurrency, t, formatPrice, locale],
  )

  const pickedLines = useMemo(
    () =>
      Object.entries(pickedQty)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({ id, qty })),
    [pickedQty],
  )

  const selectionReady =
    hasConcreteRequired ||
    (pickItems.length > 0 && pickedLines.length > 0) ||
    (!hasConcreteRequired && pickItems.length === 0)
  const canApply = availableNow && selectionReady

  useEffect(() => {
    const checkCart = () => {
      const cart = getCartItems("cart", cartSource, cartSiteId).filter(
        (c: any) =>
          cartSource !== "shop" ||
          !cartSiteId ||
          !c.site_id ||
          c.site_id === cartSiteId,
      )
      setCartCount(cart.reduce((s: number, c: any) => s + (c.cartQty || 0), 0))
      setSubtotal(
        cart.reduce(
          (s: number, c: any) => s + (c.cartPrice || 0) * (c.cartQty || 0),
          0,
        ),
      )
      // Cart prices are stored in item currency; never assume USD (breaks FX display).
      const fromCart = cart.find((c: any) => c.currency)?.currency
      setCartCurrency(fromCart || promoCurrency)
    }
    checkCart()
    window.addEventListener("storage", checkCart)
    return () => window.removeEventListener("storage", checkCart)
  }, [cartSource, cartSiteId, promoCurrency])

  const setQty = (id: string, delta: number) => {
    setPickedQty((prev) => {
      const next = Math.max(0, (prev[id] || 0) + delta)
      const copy = { ...prev }
      if (next <= 0) delete copy[id]
      else copy[id] = next
      return copy
    })
  }

  const handleAddAndApply = async () => {
    if (!availableNow) {
      toast.error(
        t("shop.promo.unavailableNow") ||
          "This offer is not available right now",
      )
      return
    }
    setLoading(true)
    try {
      const linesToAdd: {
        id: string
        name: string
        image_url?: string | null
        target_sale_price?: number | null
        currency?: string | null
        site_id?: string
        qty: number
      }[] = []

      if (hasConcreteRequired) {
        for (const row of requiredItems) {
          if (!row.item) continue
          linesToAdd.push({
            id: row.item.id,
            name:
              row.item.name ||
              t("shop.promo.productFallback") ||
              "Product",
            image_url: row.item.image_url,
            target_sale_price: row.item.target_sale_price,
            currency: row.item.currency,
            site_id: row.item.site_id || promo.site_id,
            qty: Math.max(1, row.min_quantity || 1),
          })
        }
      } else {
        for (const line of pickedLines) {
          const item = pickItems.find((p) => p.id === line.id)
          if (!item) continue
          linesToAdd.push({
            id: item.id,
            name:
              item.name || t("shop.promo.productFallback") || "Product",
            image_url: item.image_url,
            target_sale_price: item.target_sale_price,
            currency: item.currency,
            site_id: item.site_id || promo.site_id,
            qty: line.qty,
          })
        }
      }

      const existing = getCartItems("cart", cartSource, cartSiteId) as any[]
      const nextCart = [...existing]
      for (const line of linesToAdd) {
        const idx = nextCart.findIndex((c) => c.id === line.id)
        if (idx >= 0) {
          nextCart[idx] = {
            ...nextCart[idx],
            cartQty: (nextCart[idx].cartQty || 1) + line.qty,
          }
        } else {
          nextCart.push({
            id: line.id,
            name: line.name,
            image_url: line.image_url,
            target_sale_price: line.target_sale_price,
            currency: line.currency,
            site_id: line.site_id,
            cartQty: line.qty,
            cartPrice: Number(line.target_sale_price) || 0,
          })
        }
      }
      setCartItems("cart", cartSource, cartSiteId, nextCart)

      if (typeof window !== "undefined") {
        writePendingStorefrontPromo({
          code: promo.code || null,
          promotionId: promo.id,
          siteId: promo.site_id,
          surface,
        })
      }

      toast.success(t("shop.promo.applied") || "Offer added to cart")
      if (surface === "shop" && siteSlug) {
        router.push(`/shop/${siteSlug}?cart=1`)
      } else {
        router.push(`/marketplace?cart=1`)
      }
    } catch (err: any) {
      toast.error(
        err?.message ||
          t("shop.promo.applyFailed") ||
          "Failed to apply promotion",
      )
    } finally {
      setLoading(false)
    }
  }

  const ctaLabel = !availableNow
    ? t("shop.promo.unavailableCta") || "Not available now"
    : loading
      ? t("shop.promo.applying") || "Applying..."
      : t("shop.promo.addAndApply") || "Add & apply"

  return (
    <PromoStorefrontShell
      backHref={backHref}
      surface={surface}
      site={site}
      cartCount={cartCount}
      subtotal={subtotal}
      currency={cartCurrency}
    >
      <main className="flex-1 pb-24 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16 pb-32 lg:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-20">
            <div className="relative aspect-[4/5] bg-muted rounded-[2rem] overflow-hidden border shadow-sm">
              <img
                src={imageSrc}
                alt={promo.name}
                onError={(e) => {
                  e.currentTarget.style.opacity = "0"
                }}
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
              <span className="absolute left-4 top-4 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm uppercase tracking-wider">
                {label}
              </span>
            </div>

            <div className="flex flex-col py-0 sm:py-4 lg:py-8">
              <div className="mb-8 sm:mb-10">
                <PdpMetricChips
                  className="mb-4 sm:mb-6"
                  chips={[{ label: t("shop.promo.offerBadge") || "Offer" }]}
                />
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-4 sm:mb-6 leading-tight">
                  {promo.name}
                </h1>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {label}
                </p>
                {!availableNow && (
                  <p className="mt-4 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-xl px-3 py-2.5">
                    {t("shop.promo.unavailableNow") ||
                      "This offer is not available right now. Check the conditions below for valid days and dates."}
                  </p>
                )}
              </div>

              {promo.code && (
                <div className="mb-6 inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm w-fit">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono font-semibold uppercase">{promo.code}</span>
                </div>
              )}

              <div className="space-y-6 mb-8">
                {hasConcreteRequired && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("shop.promo.includes") || "Includes"}
                    </h2>
                    <div className="space-y-2">
                      {requiredItems.map((row) => (
                        <div
                          key={row.catalog_item_id}
                          className="flex items-center gap-3 rounded-2xl border bg-card p-3"
                        >
                          <div className="h-12 w-12 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                            {row.item && (
                              <img
                                src={resolveItemImage(row.item as any)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {row.item?.name ||
                                t("shop.promo.productFallback") ||
                                "Product"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("shop.promo.qty", {
                                count: row.min_quantity,
                              }) || `Qty ${row.min_quantity}`}
                              {row.item?.target_sale_price != null
                                ? ` · ${formatPrice(Number(row.item.target_sale_price), row.item.currency || promoCurrency)}`
                                : ""}
                            </div>
                          </div>
                          <Check className="h-4 w-4 text-emerald-600" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!hasConcreteRequired && pickItems.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("shop.promo.pickItems") || "Pick products for this offer"}
                    </h2>
                    <div className="space-y-2 max-h-[320px] overflow-y-auto">
                      {pickItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-2xl border bg-card p-3"
                        >
                          <div className="h-12 w-12 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                            <img
                              src={resolveItemImage(item as any)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{item.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatPrice(
                                Number(item.target_sale_price) || 0,
                                item.currency || promoCurrency,
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => setQty(item.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-5 text-center text-sm">
                              {pickedQty[item.id] || 0}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => setQty(item.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden lg:block mt-auto">
                <PdpCtaButton
                  disabled={loading || !canApply}
                  onClick={() => void handleAddAndApply()}
                >
                  {ctaLabel}
                </PdpCtaButton>
              </div>
            </div>
          </div>

          {promo.description && (
            <div className="mt-12 sm:mt-16 pt-8 border-t">
              <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
                {t("shop.promo.aboutOffer") || "About this offer"}
              </h3>
              <div className="prose prose-base sm:prose-lg dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                <p>{promo.description}</p>
              </div>
            </div>
          )}

          <PromoDetailFacts facts={detailFacts} />
        </div>
      </main>

      <PdpMobileBuyBar fullWidthCta>
        <PdpCtaButton
          disabled={loading || !canApply}
          onClick={() => void handleAddAndApply()}
          className={cn(!canApply && "opacity-50")}
        >
          {ctaLabel}
        </PdpCtaButton>
      </PdpMobileBuyBar>
    </PromoStorefrontShell>
  )
}

export {
  readPendingStorefrontPromo,
  writePendingStorefrontPromo,
} from "@/app/components/commerce/storefront-pending-promo"
