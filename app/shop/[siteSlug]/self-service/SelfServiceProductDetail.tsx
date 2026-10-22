"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { Plus, Minus } from "@/app/components/ui/icons"
import { PromptImage } from "@/app/components/commerce/PromptImage"
import { VariantPicker } from "@/app/components/commerce/pdp/VariantPicker"
import { ModifierPickerPanel, isModifierSelectionValid } from "@/app/components/commerce/ModifierPickerPanel"
import { PdpItemDescription } from "@/app/components/commerce/pdp/PdpItemDescription"
import { modifiersUnitTotal } from "@/app/commerce/cart-modifiers"
import { isSelfServiceItem } from "@/app/commerce/self-service-options"
import { isItemCompatibleWithFulfillment } from "@/app/commerce/delivery-options"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { resolveItemImage } from "@/app/lib/image-utils"
import type { CatalogItem } from "@/app/types"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"
import { SelfServiceHeader } from "./SelfServiceHeader"
import { useSelfService } from "./SelfServiceProvider"
import { useSelfServiceModifiers } from "./useSelfServiceModifiers"

export function SelfServiceProductDetail({ item, modifierGroups, modifierError }: {
  item: CatalogItem; modifierGroups: ModifierGroupWithItems[]; modifierError?: boolean
}) {
  const { context, addItem, fulfillment } = useSelfService()
  const { formatPrice } = useDisplayCurrency()
  const router = useRouter()
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState("")
  const axes = item.metadata?.variant_axes || []
  const children = useMemo<CatalogItem[]>(() => (item._shop?.children || []).map((child) => ({
    ...child,
    metadata: { ...item.metadata, ...child.metadata },
  })), [item])
  const resolved = useMemo(() => {
    if (!axes.length) return item
    if (Object.keys(selectedOptions).length !== axes.length) return null
    return children.find((child) => Object.entries(selectedOptions).every(([axis, value]) => child.metadata?.option_values?.[axis] === value)) || null
  }, [axes.length, children, item, selectedOptions])
  const modifierState = useSelfServiceModifiers(item.id, resolved?.id || null, modifierGroups, !!modifierError)
  const { modifiers, setModifiers } = modifierState
  const available = (candidate: CatalogItem) => candidate.status === "active" && candidate.availability_status !== "sold_out" &&
    candidate._shop?.sellable !== false && isSelfServiceItem(candidate, context.fulfillmentOptions, context.location.id) && isItemCompatibleWithFulfillment(candidate, fulfillment) &&
    isSelfServiceItem(item, context.fulfillmentOptions, context.location.id) && isItemCompatibleWithFulfillment(item, fulfillment)
  const valid = isModifierSelectionValid(modifierState.groups, modifiers)
  const canAdd = !!resolved && available(resolved) && valid.ok && modifierState.ready && !modifierState.error
  const active = resolved || item
  const currency = active.currency || context.site.settings?.currency || "USD"
  const unit = Number(active.target_sale_price || 0) + modifiersUnitTotal(modifiers)
  const home = `/shop/${context.location.id}`

  return <div className="min-h-screen bg-white text-gray-900">
    <SelfServiceHeader backHref={home} />
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-2 md:px-8">
      <div className="overflow-hidden rounded-2xl bg-gray-50">
        <PromptImage src={resolveItemImage(active, "full")} alt={active.name} className="aspect-square w-full object-cover" />
      </div>
      <div className="space-y-6">
        <div><h2 className="text-3xl font-bold">{item.name}</h2><p className="mt-3 text-2xl font-semibold">{formatPrice(unit, currency)}</p></div>
        <PdpItemDescription description={item.description} variant="section" showShort />
        <VariantPicker axes={axes} selectedOptions={selectedOptions} onOptionSelect={(axis, value) => setSelectedOptions((previous) => ({ ...previous, [axis]: value }))}
          childrenItems={children} isItemAvailable={available} currency={currency} />
        {!modifierState.ready ? <p role="status">Loading product options…</p> : modifierState.error ? <p role="alert">Unable to load product options. Please reload this page before ordering.</p>
          : <ModifierPickerPanel key={resolved?.id || item.id} groups={modifierState.groups} value={modifiers} onChange={setModifiers} currency={currency} />}
        <div className="flex items-center gap-4" role="group" aria-label="Quantity">
          <Button type="button" size="icon" variant="outline" aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus className="h-4 w-4" /></Button>
          <span aria-live="polite">{quantity}</span>
          <Button type="button" size="icon" variant="outline" aria-label="Increase quantity" onClick={() => setQuantity(Math.min(1000, quantity + 1))}><Plus className="h-4 w-4" /></Button>
        </div>
        {!resolved && <p className="text-sm text-gray-500">Choose your product options to continue.</p>}
        {resolved && !available(resolved) && <p role="alert">This item is unavailable for your selected order type.</p>}
        {error && <p role="alert" className="text-red-600">{error}</p>}
        <Button type="button" size="lg" className="w-full" disabled={!canAdd} onClick={() => {
          if (!resolved || !valid.ok) { setError("Choose the required options before adding this item."); return }
          addItem(resolved, quantity, modifiers)
          router.push(`${home}?cart=1`)
        }}>Add to order · {formatPrice(unit * quantity, currency)}</Button>
      </div>
    </main>
  </div>
}