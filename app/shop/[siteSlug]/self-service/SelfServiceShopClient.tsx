"use client"

import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin } from "@/app/components/ui/icons"
import { cartLineExtendedTotal } from "@/app/commerce/cart-modifiers"
import { isItemCompatibleWithFulfillment } from "@/app/commerce/delivery-options"
import { isSelfServiceItem } from "@/app/commerce/self-service-options"
import type { CheckoutCartSuccess } from "@/app/commerce/checkout-client"
import type { CatalogItem } from "@/app/types"
import type { PromoBadge, StorefrontPromoCard } from "@/app/promotions/promotion-merchandising"
import type { ShopCategoryOffset } from "../shop-catalog-shared"
import { requiresVariantSelection } from "@/app/catalog/product-details"
import { useShopCatalog } from "../useShopCatalog"
import { ShopCatalogMain } from "../ShopCatalogMain"
import { ShopHeroTrust } from "../ShopHeroTrust"
import { ShopFulfillmentHeader } from "../ShopFulfillmentHeader"
import { ShopMobileCartCta, ShopSiteFooter } from "../ShopSiteFooter"
import { SelfServiceHeader } from "./SelfServiceHeader"
import { SelfServiceCart } from "./SelfServiceCart"
import { SelfServiceConfirmation } from "./SelfServiceConfirmation"
import { useSelfService } from "./SelfServiceProvider"
import { SelfServiceCoupons } from "./SelfServiceCoupons"

export function SelfServiceShopClient({ initialCatalog, initialCount, initialCategoryOffsets, generalPromos, promoBadgesByItemId, categoryPromosByName }: {
  initialCatalog: CatalogItem[]; initialCount: number; initialCategoryOffsets: ShopCategoryOffset[]
  generalPromos: StorefrontPromoCard[]; promoBadgesByItemId: Record<string, PromoBadge>; categoryPromosByName: Record<string, StorefrontPromoCard[]>
}) {
  const { context, addItem, fulfillment, setFulfillment, cart, startNewOrder, orderVersion } = useSelfService()
  const [search, setSearch] = useState("")
  const query = useDeferredValue(search)
  const [cartOpen, setCartOpen] = useState(false)
  const [order, setOrder] = useState<CheckoutCartSuccess | null>(null)
  const router = useRouter()
  const catalog = useShopCatalog(context.site.id, initialCatalog, initialCount, query, initialCategoryOffsets, context.location.id)
  const owned = useMemo(() => new Map<string, boolean>(), [])
  const cartCount = cart.reduce((sum, line) => sum + line.cartQty, 0)
  const subtotal = cart.reduce((sum, line) => sum + cartLineExtendedTotal(line), 0)
  // A shared kiosk must not send customers to external hero destinations.
  const heroSite = useMemo(() => {
    const shop = context.site.settings?.shop
    return { ...context.site, settings: { ...context.site.settings, shop: {
      ...shop,
      ...(shop?.hero_cta_destination_type === "url" ? { hero_cta_destination_type: "scroll" } : {}),
    } } }
  }, [context.site])
  const coupons = useMemo(() => Array.from(new Map([...generalPromos, ...Object.values(categoryPromosByName).flat()]
    .map((promo) => [promo.id, promo])).values()), [generalPromos, categoryPromosByName])
  const items = useMemo(() => catalog.catalogItems.filter((item) =>
    isSelfServiceItem(item, context.fulfillmentOptions, context.location.id) && isItemCompatibleWithFulfillment(item, fulfillment) && (item._shop?.sellable !== false || item._shop?.hasVariants === true)),
  [catalog.catalogItems, context.fulfillmentOptions, context.location.id, fulfillment])

  useEffect(() => {
    if (new URL(window.location.href).searchParams.get("cart") === "1") {
      queueMicrotask(() => setCartOpen(true))
      const url = new URL(window.location.href)
      url.searchParams.delete("cart")
      window.history.replaceState({}, "", url.pathname + url.search + url.hash)
    }
  }, [])

  if (order) return <SelfServiceConfirmation order={order} onStartNew={() => { startNewOrder(); setOrder(null); setSearch("") }} />
  return <div className="flex min-h-screen flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
    <SelfServiceHeader onOpenCart={() => setCartOpen(true)} searchQuery={search} onSearchChange={setSearch} />
    <ShopHeroTrust site={heroSite} searchQuery={query} />
    <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 pt-5 md:px-8">
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4 shrink-0" />
        <span className="truncate">{context.location.name} · Self-service</span>
      </div>
      <ShopFulfillmentHeader allowedOptions={context.fulfillmentOptions} fulfillment={fulfillment} setFulfillment={setFulfillment} showSingleOption />
    </div>
    {!query.trim() && <SelfServiceCoupons promos={coupons} locationId={context.location.id} />}
    <ShopCatalogMain siteSlug={context.location.id} siteId={context.site.id} categories={catalog.categoryOffsets.map((entry) => entry.name)}
      categoryOffsets={catalog.categoryOffsets} searchQuery={query} ownedItems={[]} ownedAccessMap={owned} hideDeviceOrders
      sellableCatalogItems={items} rawCatalogItems={catalog.catalogItems} initialCount={catalog.totalCount}
      isLoading={catalog.isLoading} searchError={catalog.searchError} retrySearch={catalog.retrySearch}
      searchTruncated={catalog.searchTruncated} resultKind={catalog.resultKind} isLoadingMore={catalog.isLoadingMore}
      isJumping={catalog.isJumping} hasMoreBelow={catalog.hasMoreBelow} loadMoreBelow={catalog.loadMoreBelow}
      jumpToCategory={catalog.jumpToCategory} pendingScrollCategory={catalog.pendingScrollCategory} clearPendingScrollCategory={catalog.clearPendingScrollCategory}
      addToCart={(item) => {
        if (requiresVariantSelection(item) || item._shop?.hasRequiredModifiers) router.push(`/shop/${context.location.id}/${item.id}`)
        else { addItem(item); setCartOpen(true) }
      }} promoBadgesByItemId={promoBadgesByItemId} />
    <ShopSiteFooter siteName={context.site.name} />
    {cart.length > 0 && !cartOpen && <ShopMobileCartCta cartCount={cartCount} subtotal={subtotal} currency={cart[0]?.currency} onOpen={() => setCartOpen(true)} />}
    <SelfServiceCart key={orderVersion} open={cartOpen} onOpenChange={setCartOpen} onSuccess={setOrder} />
  </div>
}