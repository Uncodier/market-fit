"use client"

import { useEffect, useMemo, useState } from "react"
import type { CatalogItem } from "@/app/types"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import {
  ModifierPickerPanel,
  isModifierSelectionValid,
} from "@/app/components/commerce/ModifierPickerPanel"
import type { CartModifier } from "@/app/commerce/cart-modifiers"
import type { PosCartModifier } from "./CartPanel"

interface PosModifierPickerDialogProps {
  item: CatalogItem | null
  groups: ModifierGroupWithItems[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (modifiers: PosCartModifier[]) => void
  resolvePrice: (catalogItemId: string, fallbackPrice: number) => number
  /** Optional parent host for image context when adding a variant SKU. */
  hostItem?: CatalogItem | null
}

export function PosModifierPickerDialog({
  item,
  groups,
  open,
  onOpenChange,
  onConfirm,
  resolvePrice,
  hostItem = null,
}: PosModifierPickerDialogProps) {
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()
  const [selectedModifiers, setSelectedModifiers] = useState<CartModifier[]>([])

  useEffect(() => {
    if (open) setSelectedModifiers([])
  }, [open, item?.id])

  const validation = useMemo(
    () => isModifierSelectionValid(groups, selectedModifiers),
    [groups, selectedModifiers],
  )

  const extrasTotal = useMemo(
    () =>
      selectedModifiers.reduce(
        (sum, m) => sum + Number(m.cartPrice || 0) * Number(m.cartQty || 0),
        0,
      ),
    [selectedModifiers],
  )

  const contextItem = hostItem || item

  const imageContext = useMemo(() => {
    if (!contextItem) return null
    const category =
      (contextItem as any)._shop?.categoryName ||
      (typeof (contextItem as any).category === "object"
        ? (contextItem as any).category?.name
        : null) ||
      null
    return {
      parentName: contextItem.name,
      parentDescription: contextItem.description,
      category,
      siteDescription:
        (contextItem as any)._shop?.siteDescription ||
        (contextItem as any).site?.description ||
        null,
      siteName: (contextItem as any).site?.name || null,
    }
  }, [contextItem])

  const handleConfirm = () => {
    if (!validation.ok) return
    onConfirm(
      selectedModifiers.map((m) => ({
        groupId: m.groupId,
        catalogItemId: m.catalogItemId,
        name: m.name,
        cartQty: m.cartQty,
        cartPrice: m.cartPrice,
      })),
    )
    onOpenChange(false)
  }

  if (!item) return null

  const allOptional = groups.every((g) => (g.min_select ?? 0) === 0)
  const titleName = contextItem?.name || item.name
  const currency = item.currency || contextItem?.currency || "USD"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {titleName} - {t("pos.modifiers.title") || "Add extras"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 pr-1">
          <ModifierPickerPanel
            groups={groups}
            value={selectedModifiers}
            onChange={setSelectedModifiers}
            resolvePrice={resolvePrice}
            imageContext={imageContext}
            currency={currency}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {allOptional && (
            <Button
              variant="ghost"
              onClick={() => {
                onConfirm([])
                onOpenChange(false)
              }}
            >
              {t("pos.modifiers.skip") || "No extras"}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel") || "Cancel"}
          </Button>
          <Button onClick={handleConfirm} disabled={!validation.ok}>
            {t("common.confirm") || "Confirm"}
            {extrasTotal > 0
              ? ` (+${formatPrice(extrasTotal, currency)})`
              : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
