"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/app/components/ui/button"
import { PromptImage } from "@/app/components/commerce/PromptImage"
import { isItemCompatibleWithFulfillment } from "@/app/commerce/delivery-options"
import { isSelfServiceItem } from "@/app/commerce/self-service-options"
import { requiresVariantSelection } from "@/app/catalog/product-details"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import type { PromoBundleData } from "@/app/components/commerce/PromoBundleExperience"
import { resolveItemImage, resolvePromotionImage } from "@/app/lib/image-utils"
import { promoBadgeLabel } from "@/app/promotions/promotion-merchandising"
import type { CatalogItem } from "@/app/types"
import { SelfServiceHeader } from "./SelfServiceHeader"
import { useSelfService } from "./SelfServiceProvider"

export function SelfServicePromotion({ promo, items, availableNow }: {
  promo: PromoBundleData; items: Array<{ item: CatalogItem; minimum: number; configurable: boolean }>; availableNow: boolean
}) {
  const { context, cart, addItem, fulfillment, setPromotion } = useSelfService()
  const { formatPrice } = useDisplayCurrency()
  const router = useRouter()
  const [added, setAdded] = useState<string | null>(null)
  const home = `/shop/${context.location.id}`
  return <div className="min-h-screen bg-white text-gray-900">
    <SelfServiceHeader backHref={home} />
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-8">
      <PromptImage src={resolvePromotionImage(promo)} alt={promo.name} className="max-h-80 w-full rounded-2xl object-cover" />
      <h2 className="text-3xl font-bold">{promo.name}</h2>
      <p className="text-lg font-semibold">{promoBadgeLabel(promo)}</p>
      {promo.description && <p className="whitespace-pre-wrap text-gray-600">{promo.description}</p>}
      {!availableNow && <p role="alert" className="rounded-lg bg-amber-50 p-4">This offer is not available right now.</p>}
      {items.length > 0 && <>
        <h3 className="text-xl font-semibold">Choose items for this offer</h3>
        <p className="text-sm text-gray-500">Configure product options where needed. Your offer eligibility and final total are checked when ordering.</p>
        {items.map(({ item, minimum, configurable }) => {
          const compatible = isSelfServiceItem(item, context.fulfillmentOptions, context.location.id) && isItemCompatibleWithFulfillment(item, fulfillment) && item._shop?.sellable !== false
          const inCart = cart.filter((line) => line.id === item.id).reduce((sum, line) => sum + line.cartQty, 0)
          return <div key={item.id} className="flex items-center gap-4 rounded-xl border p-4">
            <PromptImage src={resolveItemImage(item, "thumb")} alt="" className="h-20 w-20 rounded-lg object-cover" />
            <div className="flex-1"><Link href={`${home}/${item.id}`} className="font-semibold">{item.name}</Link>
              <p className="text-sm">{formatPrice(Number(item.target_sale_price || 0), item.currency || "USD")}</p>
              <p className="text-sm text-gray-500">Minimum {minimum} · {inCart} in order</p></div>
            <Button type="button" variant="outline" disabled={!availableNow || !compatible} onClick={() => {
              setPromotion({ id: promo.id, code: promo.code })
              if (configurable || requiresVariantSelection(item)) router.push(`${home}/${item.id}`)
              else { addItem(item, Math.max(1, minimum - inCart)); setAdded(item.name) }
            }}>{configurable || requiresVariantSelection(item) ? "Choose options" : "Add"}</Button>
          </div>
        })}
      </>}
      {added && <p role="status">{added} added to your order.</p>}
      <Button type="button" size="lg" className="w-full" disabled={!availableNow} onClick={() => {
        setPromotion({ id: promo.id, code: promo.code })
        router.push(cart.length ? `${home}?cart=1` : home)
      }}>Apply offer and continue</Button>
      <Link href={home} className="block text-center text-sm underline">Back to menu</Link>
    </main>
  </div>
}