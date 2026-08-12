"use client"

import { useEffect, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { Plus, Trash2 } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listCatalogCategories, listCatalogItems } from "@/app/catalog/actions"
import type { CatalogItem } from "@/app/types"

type CatalogCategory = { id: string; name: string }

interface PromotionTargetPickerProps {
  siteId?: string | null
  selectedItemIds: string[]
  selectedCategoryIds: string[]
  onItemsChange: (ids: string[]) => void
  onCategoriesChange: (ids: string[]) => void
  compact?: boolean
  /** When true, only product selection is shown (no categories). */
  hideCategories?: boolean
  /** When set, shows a Min Qty input next to each selected row. */
  itemQuantities?: Record<string, number>
  categoryQuantities?: Record<string, number>
  onItemQuantityChange?: (id: string, quantity: number) => void
  onCategoryQuantityChange?: (id: string, quantity: number) => void
}

function ExpandingSelectSection({
  title,
  addLabel,
  placeholder,
  emptyMessage,
  options,
  selectedIds,
  onSelectedIdsChange,
  quantities,
  onQuantityChange,
  quantitiesLabel = "Min Qty",
}: {
  title: string
  addLabel: string
  placeholder: string
  emptyMessage: string
  options: { id: string; label: string }[]
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
  quantities?: Record<string, number>
  onQuantityChange?: (id: string, quantity: number) => void
  quantitiesLabel?: string
}) {
  // Extra blank rows beyond the selected ids. When nothing is selected, always show 1 blank.
  const [extraBlankCount, setExtraBlankCount] = useState(0)
  const showQuantities = Boolean(quantities && onQuantityChange)

  useEffect(() => {
    if (selectedIds.length === 0) setExtraBlankCount(0)
  }, [selectedIds.length])

  const blankCount = (selectedIds.length === 0 ? 1 : 0) + extraBlankCount
  const slots: Array<string | null> = [
    ...selectedIds,
    ...Array.from({ length: blankCount }, () => null),
  ]

  const setSlot = (index: number, value: RelationSelectValue) => {
    const nextId = value?.mode === "existing" ? value.id : null
    const isFilledSlot = index < selectedIds.length

    if (isFilledSlot) {
      if (!nextId) {
        onSelectedIdsChange(selectedIds.filter((_, i) => i !== index))
        return
      }
      const next = [...selectedIds]
      next[index] = nextId
      onSelectedIdsChange(next)
      return
    }

    // Blank slot → promote into selection. Base blank (when empty) is consumed by the formula.
    if (nextId) {
      onSelectedIdsChange([...selectedIds, nextId])
      if (selectedIds.length > 0) {
        setExtraBlankCount((count) => Math.max(0, count - 1))
      }
    }
  }

  const removeSlot = (index: number) => {
    const isFilledSlot = index < selectedIds.length
    if (isFilledSlot) {
      onSelectedIdsChange(selectedIds.filter((_, i) => i !== index))
      return
    }
    // Removing a blank row
    if (selectedIds.length === 0) {
      // Keep at least the base blank row
      setExtraBlankCount((count) => Math.max(0, count - 1))
      return
    }
    setExtraBlankCount((count) => Math.max(0, count - 1))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-base font-semibold">{title}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-max"
          onClick={() => setExtraBlankCount((count) => count + 1)}
        >
          <Plus className="w-4 h-4 mr-2" />
          {addLabel}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {slots.map((slotId, index) => {
          const selected = options.find((o) => o.id === slotId)
          const value: RelationSelectValue = selected
            ? { mode: "existing", id: selected.id, label: selected.label }
            : null
          const availableOptions = options.filter(
            (option) => option.id === slotId || !selectedIds.includes(option.id)
          )
          const canRemove = !(selectedIds.length === 0 && blankCount <= 1)

          return (
            <div key={`slot-${index}-${slotId || "blank"}`} className="flex gap-2 items-center">
              <div className="flex-1 min-w-0">
                <RelationSelect
                  options={availableOptions}
                  value={value}
                  onValueChange={(val) => setSlot(index, val)}
                  allowCreate={false}
                  placeholder={placeholder}
                  emptyMessage={emptyMessage}
                />
              </div>
              {showQuantities && slotId && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">
                    {quantitiesLabel}
                  </Label>
                  <Input
                    type="number"
                    className="w-16 h-9"
                    min={1}
                    value={quantities?.[slotId] ?? 1}
                    onChange={(e) =>
                      onQuantityChange?.(
                        slotId,
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                  />
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive shrink-0"
                onClick={() => removeSlot(index)}
                disabled={!canRemove}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PromotionTargetPicker({
  siteId,
  selectedItemIds,
  selectedCategoryIds,
  onItemsChange,
  onCategoriesChange,
  hideCategories = false,
  itemQuantities,
  categoryQuantities,
  onItemQuantityChange,
  onCategoryQuantityChange,
}: PromotionTargetPickerProps) {
  const { t } = useLocalization()
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([])
  const [loading, setLoading] = useState(false)
  const minQtyLabel =
    t("promotions.detail.restrictions.minQty") || "Min Qty"

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!siteId) return
      setLoading(true)
      const [itemsRes, catsRes] = await Promise.all([
        listCatalogItems({ siteId, pageSize: 1000 }),
        listCatalogCategories(siteId),
      ])
      if (!cancelled) {
        if (itemsRes.data) setCatalogItems(itemsRes.data)
        if (catsRes.data) setCatalogCategories(catsRes.data)
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [siteId])

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-16 bg-muted/40 rounded-lg animate-pulse" />
        <div className="h-16 bg-muted/40 rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!hideCategories && (
        <ExpandingSelectSection
          title={t("promotions.detail.targets.categories") || "Categories"}
          addLabel={
            t("promotions.detail.targets.addCategory") || "Add Category"
          }
          placeholder={
            t("promotions.detail.targets.selectCategory") ||
            "Select category..."
          }
          emptyMessage={
            t("promotions.detail.targets.noCategories") ||
            "No categories found"
          }
          options={catalogCategories.map((cat) => ({ id: cat.id, label: cat.name }))}
          selectedIds={selectedCategoryIds}
          onSelectedIdsChange={onCategoriesChange}
          quantities={categoryQuantities}
          onQuantityChange={onCategoryQuantityChange}
          quantitiesLabel={minQtyLabel}
        />
      )}

      <ExpandingSelectSection
        title={t("promotions.detail.targets.products") || "Products"}
        addLabel={t("promotions.detail.targets.addProduct") || "Add Product"}
        placeholder={
          t("promotions.detail.targets.selectProduct") || "Select product..."
        }
        emptyMessage={
          t("promotions.detail.targets.noProducts") || "No products found"
        }
        options={catalogItems.map((item) => ({
          id: item.id,
          label: item.sku ? `${item.name} (${item.sku})` : item.name,
        }))}
        selectedIds={selectedItemIds}
        onSelectedIdsChange={onItemsChange}
        quantities={itemQuantities}
        onQuantityChange={onItemQuantityChange}
        quantitiesLabel={minQtyLabel}
      />
    </div>
  )
}
