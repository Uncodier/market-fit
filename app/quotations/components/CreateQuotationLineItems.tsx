"use client"

import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { Plus, Trash2 } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { CreateQuotationLine } from "./create-quotation-submit"

type CatalogOption = { id: string; label: string }

interface CreateQuotationLineItemsProps {
  lineItems: CreateQuotationLine[]
  catalogOptions: CatalogOption[]
  dynamicStepsCount: number
  onAdd: () => void
  onUpdate: (key: string, value: RelationSelectValue) => void
  onUpdateQuantity?: (key: string, quantity: number) => void
  onUpdatePrice?: (key: string, price?: number) => void
  onRemove: (key: string) => void
}

export function CreateQuotationLineItems({
  lineItems,
  catalogOptions,
  dynamicStepsCount,
  onAdd,
  onUpdate,
  onUpdateQuantity,
  onUpdatePrice,
  onRemove,
}: CreateQuotationLineItemsProps) {
  const { t } = useLocalization()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>
          {t("quotations.create.fields.item") || "Product / Service (Optional)"}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onAdd}
          aria-label={t("quotations.create.addItem") || "Add product"}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {lineItems.map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <RelationSelect
              options={catalogOptions}
              value={row.value}
              onValueChange={(val) => onUpdate(row.key, val)}
              placeholder={
                t("quotations.create.fields.itemPlaceholder") ||
                "Select or create an item..."
              }
              emptyMessage={t("common.noItemsFound") || "No items found"}
            />
          </div>
          <div className="w-24 shrink-0">
            <Input
              type="number"
              min="1"
              step="1"
              className="h-10 text-center"
              placeholder={t("quotations.create.fields.quantityPlaceholder") || "Qty"}
              value={row.quantity ?? 1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val) && onUpdateQuantity) {
                  onUpdateQuantity(row.key, Math.max(1, val))
                }
              }}
            />
          </div>
          <div className="w-24 shrink-0">
            <Input
              type="number"
              min="0"
              step="0.01"
              className="h-10 text-center"
              placeholder={t("quotations.create.fields.pricePlaceholder") || "Price"}
              value={row.unitPrice === undefined ? "" : row.unitPrice}
              onChange={(e) => {
                if (e.target.value === "" && onUpdatePrice) {
                  onUpdatePrice(row.key, undefined)
                  return
                }
                const val = parseFloat(e.target.value)
                if (!isNaN(val) && onUpdatePrice) {
                  onUpdatePrice(row.key, Math.max(0, val))
                }
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`h-10 w-10 shrink-0 ${lineItems.length <= 1 ? "invisible" : ""}`}
            onClick={() => onRemove(row.key)}
            aria-label={t("quotations.create.removeItem") || "Remove product"}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {dynamicStepsCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("quotations.create.quoteAssistantHint") ||
            `${dynamicStepsCount} item(s) need quote fields on the next step.`}
        </p>
      )}
    </div>
  )
}
