"use client"

import { useMemo, useState, useEffect } from "react"
import type {
  ModifierGroupWithItems,
  ModifierImageContext,
  ModifierSelection,
} from "@/app/catalog/modifier-types"
import { validateModifierSelections } from "@/app/catalog/modifier-validate"
import type { CartModifier } from "@/app/commerce/cart-modifiers"
import { Button } from "@/app/components/ui/button"
import { Minus, Plus } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { resolveItemImage } from "@/app/lib/image-utils"
import { cn } from "@/lib/utils"

type Props = {
  groups: ModifierGroupWithItems[]
  resolvePrice?: (catalogItemId: string, fallbackPrice: number) => number
  /** Controlled selections — if omitted, panel keeps internal state. */
  value?: CartModifier[]
  onChange?: (modifiers: CartModifier[]) => void
  /** Host / site context for AI placeholder images when an option has no upload. */
  imageContext?: ModifierImageContext | null
  /** Fallback currency when an option does not define its own. */
  currency?: string
  className?: string
}

function selectionsFromQty(
  groups: ModifierGroupWithItems[],
  qtyByKey: Record<string, number>,
  resolvePrice: (id: string, fallback: number) => number,
): { selections: ModifierSelection[]; modifiers: CartModifier[] } {
  const selections: ModifierSelection[] = []
  const modifiers: CartModifier[] = []
  for (const group of groups) {
    for (const opt of group.items) {
      const key = `${group.id}:${opt.catalog_item_id}`
      const qty = qtyByKey[key] || 0
      if (qty <= 0) continue
      selections.push({
        groupId: group.id,
        catalogItemId: opt.catalog_item_id,
        quantity: qty,
      })
      modifiers.push({
        groupId: group.id,
        catalogItemId: opt.catalog_item_id,
        name: opt.name,
        cartQty: qty,
        cartPrice: resolvePrice(opt.catalog_item_id, opt.price),
      })
    }
  }
  return { selections, modifiers }
}

function optionImageUrl(
  opt: ModifierGroupWithItems["items"][number],
  imageContext?: ModifierImageContext | null,
): string {
  return resolveItemImage(
    {
      name: opt.name,
      description: opt.description,
      image_url: opt.image_url,
      category: opt.categoryName || imageContext?.category || null,
      siteDescription: imageContext?.siteDescription || null,
      site: imageContext?.siteName
        ? { name: imageContext.siteName, description: imageContext.siteDescription }
        : undefined,
      parent: imageContext?.parentName
        ? {
            name: imageContext.parentName,
            description: imageContext.parentDescription,
          }
        : undefined,
      parentRelation: "addon",
    },
    "thumb",
  )
}

export function ModifierPickerPanel({
  groups,
  resolvePrice,
  value,
  onChange,
  imageContext = null,
  currency = "USD",
  className,
}: Props) {
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()
  const priceOf = resolvePrice || ((_id, fallback) => fallback)

  const [qtyByKey, setQtyByKey] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const m of value || []) {
      initial[`${m.groupId}:${m.catalogItemId}`] = m.cartQty
    }
    return initial
  })

  useEffect(() => {
    if (!value) return
    const next: Record<string, number> = {}
    for (const m of value) {
      next[`${m.groupId}:${m.catalogItemId}`] = m.cartQty
    }
    setQtyByKey(next)
  }, [value])

  const { selections, modifiers } = useMemo(
    () => selectionsFromQty(groups, qtyByKey, priceOf),
    [groups, qtyByKey, priceOf],
  )

  const validation = useMemo(
    () => validateModifierSelections(groups, selections),
    [groups, selections],
  )

  const setQty = (groupId: string, catalogItemId: string, nextQty: number) => {
    const copy = { ...qtyByKey }
    const key = `${groupId}:${catalogItemId}`
    if (nextQty <= 0) delete copy[key]
    else copy[key] = nextQty
    
    setQtyByKey(copy)
    const { modifiers: nextMods } = selectionsFromQty(groups, copy, priceOf)
    onChange?.(nextMods)
  }

  if (!groups.length) return null

  return (
    <div className={cn("space-y-5", className)} data-valid={validation.ok ? "1" : "0"}>
      {groups.map((group) => {
        const min = group.min_select ?? 0
        const max = group.max_select
        const label =
          min > 0
            ? t("pos.modifiers.required") || "Required"
            : t("pos.modifiers.optional") || "Optional"
        const range =
          max == null ? `${min}+` : min === max ? String(min) : `${min}–${max}`
        const groupTotal = selections
          .filter((s) => s.groupId === group.id)
          .reduce((n, s) => n + s.quantity, 0)

        return (
          <div key={group.id} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold">{group.name}</h4>
              <span className="text-xs text-muted-foreground">
                {label} ({range})
              </span>
            </div>
            <div className="space-y-1.5">
              {group.items.map((opt) => {
                const key = `${group.id}:${opt.catalog_item_id}`
                const qty = qtyByKey[key] || 0
                const price = priceOf(opt.catalog_item_id, opt.price)
                const imageUrl = optionImageUrl(opt, imageContext)
                return (
                  <div
                    key={opt.catalog_item_id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
                      qty > 0 && "border-foreground/30 bg-muted/40",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                        <img
                          src={imageUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover object-center"
                          onError={(e) => {
                            e.currentTarget.style.opacity = "0"
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{opt.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatPrice(price, opt.currency || currency)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setQty(group.id, opt.catalog_item_id, qty - 1)}
                        disabled={qty <= 0}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center text-sm font-medium">{qty}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setQty(group.id, opt.catalog_item_id, qty + 1)}
                        disabled={max != null && groupTotal >= max}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      {!validation.ok && (
        <p className="text-xs text-destructive">{validation.error}</p>
      )}
      <input type="hidden" data-modifiers={JSON.stringify(modifiers)} readOnly />
    </div>
  )
}

export function isModifierSelectionValid(
  groups: ModifierGroupWithItems[],
  modifiers: CartModifier[],
) {
  const selections: ModifierSelection[] = modifiers.map((m) => ({
    groupId: m.groupId,
    catalogItemId: m.catalogItemId,
    quantity: m.cartQty,
  }))
  return validateModifierSelections(groups, selections)
}
