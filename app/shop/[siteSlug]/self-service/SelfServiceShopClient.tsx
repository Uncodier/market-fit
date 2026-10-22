"use client"

import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { isItemCompatibleWithFulfillment } from "@/app/commerce/delivery-options"
import { isSelfServiceItem } from "@/app/commerce/self-service-options"
import type { CheckoutCartSuccess } from "@/app/commerce/checkout-client"
import type { CatalogItem } from "@/app/types"
import type { PromoBadge, StorefrontPromoCard } from "@/app/promotions/promotion-merchandising"
import type { ShopCategoryOffset } from "../shop-catalog-shared"
import { requiresVariantSelection } from "@/app/catalog/product-details"
import { useShopCatalog } from "../useShopCatalog"
import { ShopCatalogMain } from "../ShopCatalogMain"
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
  return <div className="flex min-h-screen flex-col bg-white text-gray-900">
    <SelfServiceHeader onOpenCart={() => setCartOpen(true)} />
    <div className="mx-auto flex w-full max-w-7xl flex-wrap gap-3 px-4 py-5 md:px-8">
      <Input aria-label="Search menu" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu…" className="min-w-44 flex-1" />
      <div role="group" aria-label="Fulfillment method" className="flex gap-2">
        {context.fulfillmentOptions.map((option) => <Button key={option} type="button" variant={fulfillment === option ? "default" : "outline"} aria-pressed={fulfillment === option} onClick={() => setFulfillment(option)}>{option === "dine_in" ? "Dine in" : "Pickup"}</Button>)}
      </div>
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
    {cart.length > 0 && <Button type="button" className="sticky bottom-4 mx-4 mb-4 md:hidden" onClick={() => setCartOpen(true)}>View order · {cart.reduce((sum, line) => sum + line.cartQty, 0)} items</Button>}
    <SelfServiceCart key={orderVersion} open={cartOpen} onOpenChange={setCartOpen} onSuccess={setOrder} />
  </div>
}