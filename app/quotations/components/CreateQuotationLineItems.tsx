"use client"

import { Button } from "@/app/components/ui/button"
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
  onRemove: (key: string) => void
}

export function CreateQuotationLineItems({
  lineItems,
  catalogOptions,
  dynamicStepsCount,
  onAdd,
  onUpdate,
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
        <div key={row.key} className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <RelationSelect
              options={catalogOptions}
              value={row.value}
              onValueChange={(val) => onUpdate(row.key, val)}
              placeholder={
                t("quotations.create.fields.itemPlaceholder") ||
                "Select or create an item..."
              }
              emptyMessage="No items found"
            />
          </div>
          {lineItems.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => onRemove(row.key)}
              aria-label="Remove product"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
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
