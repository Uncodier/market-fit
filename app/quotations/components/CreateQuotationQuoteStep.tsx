"use client"

import { CatalogItem } from "@/app/types"
import { getDynamicPricingConfig } from "@/app/catalog/dynamic-pricing"
import { DynamicQuoteFieldsForm } from "@/app/components/commerce/DynamicQuoteFieldsForm"
import { useLocalization } from "@/app/context/LocalizationContext"

export type QuoteFieldDraft = {
  values: Record<string, unknown>
  quantity: number
}

interface CreateQuotationQuoteStepProps {
  item: CatalogItem
  stepNumber: number
  totalFieldSteps: number
  draft: QuoteFieldDraft
  onDraftChange: (draft: QuoteFieldDraft) => void
  error: string | null
  submitting?: boolean
}

export function CreateQuotationQuoteStep({
  item,
  stepNumber,
  totalFieldSteps,
  draft,
  onDraftChange,
  error,
  submitting,
}: CreateQuotationQuoteStepProps) {
  const { t } = useLocalization()
  const config = getDynamicPricingConfig(item)
  if (!config) return null

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("quotations.create.quoteStep") || "Quote fields"} {stepNumber} /{" "}
          {totalFieldSteps}
        </p>
        <h3 className="text-base font-semibold mt-1">{item.name}</h3>
      </div>

      <DynamicQuoteFieldsForm
        config={config}
        values={draft.values}
        onChange={(values) => onDraftChange({ ...draft, values })}
        quantity={draft.quantity}
        onQuantityChange={(quantity) => onDraftChange({ ...draft, quantity })}
        showQuantity
        showExpirationHint
        disabled={submitting}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
