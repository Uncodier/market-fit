"use client"

import { useMemo, useState } from "react"
import type { CatalogItem } from "@/app/types"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { VariantPicker } from "@/app/components/commerce/pdp/VariantPicker"
import {
  ModifierPickerPanel,
  isModifierSelectionValid,
} from "@/app/components/commerce/ModifierPickerPanel"
import type { CartModifier } from "@/app/commerce/cart-modifiers"
import { usePosOptionsData } from "./pos-options-data"
import type { PosCartModifier } from "./CartPanel"
import type { PosItemAvailability } from "../cart-availability"

export type PosOptionsConfirm = {
  item: CatalogItem
  modifiers: PosCartModifier[]
}

type Props = {
  item: CatalogItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (result: PosOptionsConfirm) => void
  resolvePrice: (catalogItemId: string, fallbackPrice: number) => number
  siteId?: string
  /** Dexie / snapshot cache: hostId → groups */
  modifierGroupsByHostId?: Record<string, ModifierGroupWithItems[]>
  catalogItems?: CatalogItem[]
  getAvailability?: (item: CatalogItem) => PosItemAvailability
}

export function PosOptionsDialog(props: Props) {
  return <PosOptionsDialogContent key={`${props.item?.id || "none"}:${props.open}`} {...props} />
}

function PosOptionsDialogContent({
  item,
  open,
  onOpenChange,
  onConfirm,
  resolvePrice,
  siteId,
  modifierGroupsByHostId,
  catalogItems,
  getAvailability,
}: Props) {
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()

  const { children, axes, modifierGroups, loading, error } = usePosOptionsData({
    item, open, siteId, catalogItems, modifierGroupsByHostId,
  })
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    {},
  )
  const [modifierSelections, setSelectedModifiers] = useState<CartModifier[]>([])
  const selectedModifiers = useMemo(() => modifierSelections.flatMap((selection) => {
    const option = modifierGroups.find((group) => group.id === selection.groupId)?.items
      .find((candidate) => candidate.catalog_item_id === selection.catalogItemId)
    if (!option) return []
    return [{
      ...selection,
      name: option.name,
      cartPrice: resolvePrice(option.catalog_item_id, option.price),
    }]
  }), [modifierSelections, modifierGroups, resolvePrice])

  const resolvedChild = useMemo(() => {
    if (!axes.length) return null
    if (Object.keys(selectedOptions).length !== axes.length) return null
    if (!axes.every((axis) => selectedOptions[axis.id])) return null
    return (
      children.find((c) => {
        const childOpts = c.metadata?.option_values
        if (!childOpts) return false
        return Object.entries(selectedOptions).every(
          ([aId, vId]) => childOpts[aId] === vId,
        )
      }) || null
    )
  }, [selectedOptions, axes, children])

  const needsVariant = axes.length > 0
  const sellableItem = needsVariant ? resolvedChild : item

  const modifiersValid = isModifierSelectionValid(modifierGroups, selectedModifiers).ok

  const extrasTotal = useMemo(
    () =>
      selectedModifiers.reduce(
        (sum, m) => sum + Number(m.cartPrice || 0) * Number(m.cartQty || 0),
        0,
      ),
    [selectedModifiers],
  )

  const imageContext = useMemo(() => {
    if (!item) return null
    return {
      parentName: item.name,
      parentDescription: item.description,
      category:
        item._shop?.categoryName ||
        (typeof item.category === "object"
          ? item.category?.name
          : null) ||
        null,
      siteDescription:
        item._shop?.siteDescription ||
        item.site?.description ||
        null,
      siteName: item.site?.name || null,
    }
  }, [item])

  const availability = sellableItem ? getAvailability?.(sellableItem) : undefined
  const canConfirm = !!sellableItem && modifiersValid && !loading && !error && availability?.sellable !== false

  const handleConfirm = () => {
    if (!sellableItem || !canConfirm || !item) return
    const confirmedItem = needsVariant ? { ...sellableItem, _parent: { name: item.name } } : sellableItem
    onConfirm({
      item: confirmedItem,
      modifiers: selectedModifiers.map((m) => ({
        groupId: m.groupId,
        catalogItemId: m.catalogItemId,
        name: m.name,
        cartQty: m.cartQty,
        cartPrice: m.cartPrice,
      })),
    })
    onOpenChange(false)
  }

  if (!item) return null

  const currency = item.currency || "USD"
  const showModifiers = !loading && !error && modifierGroups.length > 0

  const isReservable = item?.is_reservation || sellableItem?.is_reservation
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {item.name} - {t("pos.options.title") || "Options"}
          </DialogTitle>
          <DialogDescription className="sr-only">Choose an available option and any extras before adding this item.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              Unable to load item options. Close this dialog and sync the catalog before trying again.
            </p>
          ) : loading ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            </div>
          ) : (
            <>
              {needsVariant && (
                <div className="[&_.mb-8]:mb-0 [&_.space-y-8]:space-y-4 [&_section]:p-4 [&_section]:rounded-2xl [&_.grid]:!grid-cols-1">
                  <VariantPicker
                    axes={axes}
                    selectedOptions={selectedOptions}
                    onOptionSelect={(axisId, valueId) =>
                      setSelectedOptions((prev) => {
                        const next = { ...prev, [axisId]: valueId }
                        const hasAvailableCombination = children.some((child) =>
                          getAvailability?.(child).sellable !== false && Object.entries(next).every(
                            ([axis, value]) => child.metadata?.option_values?.[axis] === value,
                          ),
                        )
                        return hasAvailableCombination ? next : { [axisId]: valueId }
                      })
                    }
                    childrenItems={children}
                    isItemAvailable={(child) => getAvailability?.(child).sellable !== false}
                    presentation="pdp"
                    currency={currency}
                    fallbackImageUrl={item.image_url || null}
                    imageContext={imageContext}
                  />
                </div>
              )}

              {showModifiers && (
                <div className="space-y-2">
                  {!needsVariant ? null : (
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("pos.modifiers.title") || "Add extras"}
                    </h4>
                  )}
                  <ModifierPickerPanel
                    groups={modifierGroups}
                    value={selectedModifiers}
                    onChange={setSelectedModifiers}
                    resolvePrice={resolvePrice}
                    imageContext={imageContext}
                    currency={currency}
                  />
                </div>
              )}

              {!needsVariant && !showModifiers && (
                <p className="text-sm text-muted-foreground">
                  {t("pos.options.noChoices") || "No options for this item."}
                </p>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter className="gap-2 sm:gap-2">
          {availability && availability.status !== "available" && (
            <p role="status" className="text-sm text-amber-600">
              {availability.status === "backorder" ? "Backorder — insufficient stock"
                : availability.status === "unknown" ? "Stock unknown — sync the catalog" : "Sold out"}
            </p>
          )}
          {showModifiers &&
            modifierGroups.every((g) => (g.min_select ?? 0) === 0) && (
              <Button
                variant="ghost"
                disabled={!sellableItem || loading || error || availability?.sellable === false}
                onClick={() => {
                  if (!sellableItem || loading || error || availability?.sellable === false) return
                  onConfirm({ item: sellableItem, modifiers: [] })
                  onOpenChange(false)
                }}
              >
                {t("pos.modifiers.skip") || "No extras"}
              </Button>
            )}
          <Button
            variant="outline"
            className="hidden md:inline-flex"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel") || "Cancel"}
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {isReservable && sellableItem 
              ? (t("pos.options.selectTime") || "Select Time") 
              : (t("common.confirm") || "Confirm")}
            {extrasTotal > 0
              ? ` (+${formatPrice(extrasTotal, currency)})`
              : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
